const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    image: { type: String },
    variantLabel: { type: String, default: "" },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
    specialInstructions: { type: String, default: "" },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: "Deal" },
    dealItems: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: String,
        quantity: Number,
        _id: false,
      },
    ],
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    accessToken: { type: String, default: "" },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    orderType: { type: String, enum: ["delivery", "pickup"], default: "delivery" },
    deliveryAddress: {
      line1: String,
      city: String,
      area: String,
      instructions: String,
    },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    dealCode: { type: String, default: "" },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cash", "online"], default: "cash" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentScreenshot: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "out_for_delivery", "ready_for_pickup", "delivered", "pickup_complete", "cancelled"],
      default: "pending",
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    pickupTime: { type: String, default: "" },
    deliveryTime: { type: String, default: "" },
    pickupPrepMinutes: { type: Number, default: 25 },
  },
  { timestamps: true }
);

orderSchema.statics.getAllowedStatuses = function (orderType) {
  if (orderType === "pickup") {
    return ["pending", "confirmed", "preparing", "ready_for_pickup", "pickup_complete", "cancelled"];
  }
  return ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
};

orderSchema.methods.isValidTransition = function (newStatus) {
  const allowed = this.constructor.getAllowedStatuses(this.orderType);
  return allowed.includes(newStatus);
};

module.exports = mongoose.model("Order", orderSchema);
