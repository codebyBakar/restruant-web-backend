const asyncHandler = require("../middleware/asyncHandler");
const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Deal = require("../models/Deal");
const Settings = require("../models/Settings");
const generateOrderNumber = require("../utils/orderNumber");
const { clearCacheByPrefix } = require("../middleware/cache");
const { getFileUrl } = require("../config/cloudinary");
const { sendOrderConfirmationEmail, sendOrderStatusEmail, sendOrderCompletionEmail } = require("../utils/email");
const { isStoreOpen, storeClosedMessage } = require("../utils/storeStatus");

// Recalculate totals server-side from trusted DB data (never trust client prices)
const buildOrderPricing = async ({ items, orderType }) => {
  const settings = (await Settings.findOne({ key: "site" })) || {};
  let subtotal = 0;
  const builtItems = [];

  for (const item of items) {
    if (item.dealId) {
      const deal = await Deal.findById(item.dealId).populate("items.product");
      if (!deal || !deal.isActive) {
        throw Object.assign(new Error("This deal is no longer available"), { statusCode: 400 });
      }
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const lineTotal = deal.price * quantity;
      subtotal += lineTotal;
      builtItems.push({
        product: deal.items[0]?.product?._id || item.dealId,
        name: deal.title,
        image: deal.image?.url || "",
        unitPrice: deal.price,
        quantity,
        lineTotal,
        dealId: deal._id,
        dealItems: deal.items.map((di) => ({
          product: di.product?._id || di.product,
          productName: di.product?.name || di.productName || "",
          quantity: di.quantity,
        })),
      });
      continue;
    }

    const product = await Product.findById(item.productId);
    if (!product || !product.isAvailable) {
      throw Object.assign(new Error("This product is no longer available"), { statusCode: 400 });
    }

    let unitPrice = product.discountPrice || product.basePrice;
    let variantLabel = "";
    if (item.variantLabel) {
      const variant = product.variants.find((v) => v.label === item.variantLabel);
      if (variant) {
        unitPrice = variant.price;
        variantLabel = variant.label;
      }
    }

    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;

    builtItems.push({
      product: product._id,
      name: product.name,
      image: product.images?.[0]?.url || "",
      variantLabel,
      unitPrice,
      quantity,
      lineTotal,
      specialInstructions: item.specialInstructions || "",
    });
  }

  const deliveryFee =
    orderType === "delivery"
      ? subtotal >= Number(settings.freeDeliveryThreshold ?? 1500)
        ? 0
        : Number(settings.deliveryFee ?? 100)
      : 0;

  const tax = Math.round((subtotal * Number(settings.taxPercent ?? 5)) / 100);
  const total = Math.max(0, subtotal + tax + deliveryFee);

  return { builtItems, subtotal, deliveryFee, tax, total, settings };
};

// @desc Create order (cash/pickup). Online orders are created via POST /orders/online
//       once the customer uploads their bank-transfer payment screenshot.
// @route POST /api/orders
exports.createOrder = asyncHandler(async (req, res) => {
  const { customer, orderType, deliveryAddress, items, paymentMethod } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "Cart is empty" });
  }

  if (paymentMethod === "online") {
    return res.status(400).json({
      success: false,
      message: "Online payment orders are placed after uploading the payment screenshot",
    });
  }

  const pricing = await buildOrderPricing({ items, orderType });

  if (!isStoreOpen(pricing.settings)) {
    return res.status(400).json({
      success: false,
      message: storeClosedMessage(pricing.settings),
    });
  }

  if (pricing.total < (pricing.settings.minOrderAmount || 0)) {
    return res.status(400).json({
      success: false,
      message: `Minimum order amount is ${pricing.settings.currency || "Rs."} ${pricing.settings.minOrderAmount}`,
    });
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    accessToken: crypto.randomBytes(16).toString("hex"),
    customer,
    orderType,
    deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
    items: pricing.builtItems,
    subtotal: pricing.subtotal,
    deliveryFee: pricing.deliveryFee,
    tax: pricing.tax,
    total: pricing.total,
    paymentMethod,
    paymentStatus: "pending",
    statusHistory: [{ status: "pending" }],
  });

  clearCacheByPrefix("/api/orders");

  sendOrderConfirmationEmail(
    order,
    pricing.settings?.siteName || "Pratha",
    pricing.settings?.currency || "Rs.",
    pricing.settings?.logo?.url || ""
  ).catch((err) =>
    console.error("[Email] Unexpected error:", err.message || err)
  );

  res.status(201).json({ success: true, data: order });
});

// @desc Create online-payment order with the bank-transfer payment screenshot.
//       The order is created once, at the moment the screenshot is submitted —
//       it reaches admin already complete, exactly one order.
// @route POST /api/orders/online
exports.createOnlineOrder = asyncHandler(async (req, res) => {
  const { customer, orderType, deliveryAddress, items, paymentMethod } = req.body;

  if (paymentMethod !== "online") {
    return res.status(400).json({ success: false, message: "Online orders require bank transfer payment" });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a payment screenshot" });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: "Cart is empty" });
  }

  const pricing = await buildOrderPricing({ items, orderType });

  if (!isStoreOpen(pricing.settings)) {
    return res.status(400).json({
      success: false,
      message: storeClosedMessage(pricing.settings),
    });
  }

  if (pricing.total < (pricing.settings.minOrderAmount || 0)) {
    return res.status(400).json({
      success: false,
      message: `Minimum order amount is ${pricing.settings.currency || "Rs."} ${pricing.settings.minOrderAmount}`,
    });
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    accessToken: crypto.randomBytes(16).toString("hex"),
    customer,
    orderType,
    deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
    items: pricing.builtItems,
    subtotal: pricing.subtotal,
    deliveryFee: pricing.deliveryFee,
    tax: pricing.tax,
    total: pricing.total,
    paymentMethod: "online",
    paymentStatus: "pending",
    paymentScreenshot: getFileUrl(req, req.file),
    statusHistory: [{ status: "pending" }],
  });

  clearCacheByPrefix("/api/orders");

  sendOrderConfirmationEmail(
    order,
    pricing.settings?.siteName || "Pratha",
    pricing.settings?.currency || "Rs.",
    pricing.settings?.logo?.url || ""
  ).catch((err) =>
    console.error("[Email] Unexpected error:", err.message || err)
  );

  res.status(201).json({ success: true, data: order });
});

// @desc Upload payment screenshot for online payment order
// @route POST /api/orders/:orderNumber/screenshot
exports.uploadPaymentScreenshot = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const { email, token } = req.query;

  const query = { orderNumber };
  if (token) query.accessToken = token;
  else query["customer.email"] = email;

  const order = await Order.findOne(query);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (order.paymentMethod !== "online") {
    return res.status(400).json({ success: false, message: "This order does not use online payment" });
  }

  if (order.paymentScreenshot?.url) {
    return res.status(400).json({ success: false, message: "Payment screenshot already uploaded" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a payment screenshot" });
  }

  order.paymentScreenshot = getFileUrl(req, req.file);
  await order.save();

  clearCacheByPrefix("/api/orders");
  res.status(200).json({ success: true, data: order, message: "Payment screenshot uploaded. Awaiting admin verification." });
});

// @desc Track order by order number (public, requires email match or access token)
// @route GET /api/orders/track/:orderNumber
exports.trackOrder = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;
  const { email, token } = req.query;

  const query = { orderNumber };
  if (token) query.accessToken = token;
  else query["customer.email"] = email;

  const order = await Order.findOne(query);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  res.status(200).json({ success: true, data: order });
});

// @desc Get all orders for a customer by email (public)
// @route GET /api/orders/my-orders
exports.getMyOrders = asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });
  const orders = await Order.find({ "customer.email": email }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// @desc Get all orders (admin) with filters
// @route GET /api/orders
exports.getOrders = asyncHandler(async (req, res) => {
  const { status, paymentStatus, orderType, page = 1, limit = 20, search } = req.query;
  const query = {};
  if (status) {
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    query.orderStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (orderType) query.orderType = orderType;
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "customer.name": { $regex: search, $options: "i" } },
      { "customer.phone": { $regex: search, $options: "i" } },
    ];
  }

  const pageNum = Math.max(parseInt(page, 10), 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);

  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Order.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: orders,
  });
});

// @desc Get single order (admin)
// @route GET /api/orders/:id
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  res.status(200).json({ success: true, data: order });
});

// @desc Delete order (admin) - only completed or cancelled orders
// @route DELETE /api/orders/:id
exports.deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  const deletable = ["delivered", "pickup_complete", "cancelled"];
  if (!deletable.includes(order.orderStatus)) {
    return res.status(400).json({
      success: false,
      message: `Only completed or cancelled orders can be deleted. This order is "${order.orderStatus}".`,
    });
  }

  await order.deleteOne();
  clearCacheByPrefix("/api/orders");
  res.status(200).json({ success: true, message: "Order deleted successfully" });
});

// @desc Update order status (admin)
// @route PUT /api/orders/:id/status
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, paymentStatus } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (orderStatus) {
    if (!order.isValidTransition(orderStatus)) {
      const allowed = Order.getAllowedStatuses(order.orderType);
      return res.status(400).json({
        success: false,
        message: `Invalid status "${orderStatus}" for ${order.orderType} order. Allowed: ${allowed.join(", ")}`,
      });
    }
    order.orderStatus = orderStatus;
    order.statusHistory.push({ status: orderStatus });
    const now = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    if (orderStatus === "ready_for_pickup" || orderStatus === "pickup_complete") {
      if (!order.pickupTime) order.pickupTime = now;
    }
    if (orderStatus === "out_for_delivery") order.deliveryTime = now;
  }
  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (req.body.pickupPrepMinutes !== undefined) {
    order.pickupPrepMinutes = req.body.pickupPrepMinutes;
  }

  await order.save();
  clearCacheByPrefix("/api/orders");

  if (orderStatus === "out_for_delivery" || orderStatus === "ready_for_pickup" || orderStatus === "delivered" || orderStatus === "pickup_complete") {
const settings = (await Settings.findOne({ key: "site" })) || {};
  const siteName = settings.siteName || "Pratha";
  const symbol = settings.currency || "Rs.";
  const logoUrl = settings.logo?.url || "";

  if (orderStatus === "delivered" || orderStatus === "pickup_complete") {
    sendOrderCompletionEmail(order, siteName, symbol, logoUrl).catch((err) =>
      console.error("[Email] Completion email error:", err.message || err)
    );
  } else {
    sendOrderStatusEmail(order, orderStatus, siteName, symbol, logoUrl).catch((err) =>
      console.error("[Email] Status email error:", err.message || err)
    );
  }
  }

  res.status(200).json({ success: true, data: order });
});

// @desc Dashboard stats (admin)
// @route GET /api/orders/stats/dashboard
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayOrders, totalOrders, pendingOrders, revenueAgg, statusCounts] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: today } }),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: { $in: ["pending", "confirmed", "preparing"] } }),
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      todayOrders,
      totalOrders,
      pendingOrders,
      totalRevenue: revenueAgg[0]?.total || 0,
      statusBreakdown: statusCounts,
    },
  });
});
