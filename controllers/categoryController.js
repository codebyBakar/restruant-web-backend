const asyncHandler = require("../middleware/asyncHandler");
const Category = require("../models/Category");
const Order = require("../models/Order");
const { cloudinary, getFileUrl, isCloudinaryConfigured } = require("../config/cloudinary");
const { clearCacheByPrefix } = require("../middleware/cache");

exports.getCategories = asyncHandler(async (req, res) => {
  const filter = req.query.all === "true" ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ displayOrder: 1, name: 1 });
  res.status(200).json({ success: true, count: categories.length, data: categories });
});

exports.getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });
  res.status(200).json({ success: true, data: category });
});

exports.getCategoryOrderStats = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).select("_id name");
  const categoryIds = categories.map((c) => c._id);

  const orderStats = await Order.aggregate([
    { $match: { orderStatus: { $ne: "cancelled" } } },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "p",
      },
    },
    { $match: { "p.category": { $in: categoryIds } } },
    { $group: { _id: "$_id", cats: { $addToSet: { $arrayElemAt: ["$p.category", 0] } } } },
    { $unwind: "$cats" },
    { $group: { _id: "$cats", count: { $sum: 1 } } },
  ]);

  const counts = {};
  orderStats.forEach((s) => (counts[s._id] = s.count));

  res.status(200).json({
    success: true,
    data: categories.map((c) => ({ _id: c._id, name: c.name, orderCount: counts[c._id] || 0 })),
  });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) {
    data.image = getFileUrl(req, req.file);
  }
  const category = await Category.create(data);
  clearCacheByPrefix("/api/categories");
  res.status(201).json({ success: true, data: category });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  if (req.file) {
    if (category.image?.publicId && isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(category.image.publicId).catch(() => {});
    }
    category.image = getFileUrl(req, req.file);
  }

  Object.assign(category, req.body);
  await category.save();
  clearCacheByPrefix("/api/categories");
  res.status(200).json({ success: true, data: category });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });

  if (category.image?.publicId && isCloudinaryConfigured) {
    await cloudinary.uploader.destroy(category.image.publicId).catch(() => {});
  }
  await category.deleteOne();
  clearCacheByPrefix("/api/categories");
  res.status(200).json({ success: true, message: "Category deleted" });
});
