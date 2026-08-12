const asyncHandler = require("../middleware/asyncHandler");
const Product = require("../models/Product");
const { cloudinary, getFileUrl, isCloudinaryConfigured } = require("../config/cloudinary");
const { clearCacheByPrefix } = require("../middleware/cache");

// @desc Get all products with filtering, search, sorting, pagination
// @route GET /api/products
exports.getProducts = asyncHandler(async (req, res) => {
  const { category, tag, search, isVeg, featured, sort, page = 1, limit = 20, availableOnly } = req.query;

  const query = {};
  if (category) query.category = category;
  if (tag) query.tags = tag;
  if (isVeg !== undefined) query.isVeg = isVeg === "true";
  if (featured === "true") query.isFeatured = true;
  if (availableOnly === "true") query.isAvailable = true;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.name = { $regex: `\\b${escaped}\\b`, $options: "i" };
  }

  const sortMap = {
    priceLow: { basePrice: 1 },
    priceHigh: { basePrice: -1 },
    newest: { createdAt: -1 },
    rating: { rating: -1 },
    default: { displayOrder: 1, createdAt: -1 },
  };
  const sortOption = sortMap[sort] || sortMap.default;

  const pageNum = Math.max(parseInt(page, 10), 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name slug")
      .populate("tags", "name colorHex slug")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),
    Product.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: products,
  });
});

// @desc Get single product by slug
// @route GET /api/products/:slug
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug })
    .populate("category", "name slug")
    .populate("tags", "name colorHex slug");

  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  res.status(200).json({ success: true, data: product });
});

// @desc Create product
// @route POST /api/products
exports.createProduct = asyncHandler(async (req, res) => {
  const data = { ...req.body };

  if (data.tags && typeof data.tags === "string") {
    data.tags = data.tags.split(",").map((t) => t.trim()).filter(Boolean);
  } else if (data.tags === "") {
    data.tags = [];
  }
  if (data.variants && typeof data.variants === "string") {
    data.variants = JSON.parse(data.variants).map((v) => ({ ...v, price: Number(v.price) }));
  }
  if (data.ingredients && typeof data.ingredients === "string") {
    data.ingredients = data.ingredients.split(",").map((i) => i.trim()).filter(Boolean);
  } else if (data.ingredients === "") {
    data.ingredients = [];
  }

  if (req.files && req.files.length > 0) {
    data.images = req.files.map((f) => getFileUrl(req, f));
  }

  const product = await Product.create(data);
  clearCacheByPrefix("/api/products");
  res.status(201).json({ success: true, data: product });
});

// @desc Update product
// @route PUT /api/products/:id
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const data = { ...req.body };
  if (data.tags && typeof data.tags === "string") {
    data.tags = data.tags.split(",").map((t) => t.trim()).filter(Boolean);
  } else if (data.tags === "") {
    data.tags = [];
  }
  if (data.variants && typeof data.variants === "string") {
    data.variants = JSON.parse(data.variants).map((v) => ({ ...v, price: Number(v.price) }));
  }
  if (data.ingredients && typeof data.ingredients === "string") {
    data.ingredients = data.ingredients.split(",").map((i) => i.trim()).filter(Boolean);
  } else if (data.ingredients === "") {
    data.ingredients = [];
  }

  if (req.files && req.files.length > 0) {
    if (isCloudinaryConfigured) {
      for (const img of product.images) {
        if (img.publicId) await cloudinary.uploader.destroy(img.publicId).catch(() => {});
      }
    }
    data.images = req.files.map((f) => getFileUrl(req, f));
  }

  Object.assign(product, data);
  await product.save();
  clearCacheByPrefix("/api/products");
  res.status(200).json({ success: true, data: product });
});

// @desc Delete product
// @route DELETE /api/products/:id
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  if (isCloudinaryConfigured) {
    for (const img of product.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId).catch(() => {});
    }
  }
  await product.deleteOne();
  clearCacheByPrefix("/api/products");
  res.status(200).json({ success: true, message: "Product deleted" });
});

// @desc Delete single image from a product
// @route DELETE /api/products/:id/images/:publicId
exports.deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });

  const publicId = decodeURIComponent(req.params.publicId);
  product.images = product.images.filter((img) => img.publicId !== publicId);
  if (isCloudinaryConfigured) {
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
  await product.save();
  clearCacheByPrefix("/api/products");
  res.status(200).json({ success: true, data: product });
});
