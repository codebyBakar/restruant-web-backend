const asyncHandler = require("../middleware/asyncHandler");
const Deal = require("../models/Deal");
const { cloudinary, getFileUrl, isCloudinaryConfigured } = require("../config/cloudinary");
const { clearCacheByPrefix } = require("../middleware/cache");

exports.getDeals = asyncHandler(async (req, res) => {
  const query = {};
  if (!req.query.all) {
    query.isActive = true;
    query.$or = [
      { isForLife: true },
      { startDate: { $lte: new Date() }, endDate: { $gte: new Date() } },
      { startDate: { $exists: false } },
    ];
  }
  const results = await Deal.find(query)
    .populate("items.product", "name basePrice discountPrice images slug")
    .sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: results.length, data: results });
});

exports.getDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id).populate("items.product");
  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });
  res.status(200).json({ success: true, data: deal });
});

exports.createDeal = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (typeof data.items === "string") {
    try {
      data.items = JSON.parse(data.items).map((it) => ({ ...it, quantity: Number(it.quantity) }));
    } catch {
      data.items = [];
    }
  }
  if (req.file) {
    data.image = getFileUrl(req, req.file);
  }
  if (data.isForLife === "true" || data.isForLife === true) {
    data.isForLife = true;
    data.startDate = undefined;
    data.endDate = undefined;
  }
  if (data.isForLife === "false") data.isForLife = false;
  data.price = Number(data.price);
  const deal = await Deal.create(data);
  clearCacheByPrefix("/api/deals");
  res.status(201).json({ success: true, data: deal });
});

exports.updateDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id);
  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });

  const data = { ...req.body };
  if (typeof data.items === "string") {
    try {
      data.items = JSON.parse(data.items).map((it) => ({ ...it, quantity: Number(it.quantity) }));
    } catch {
      data.items = [];
    }
  }
  if (req.file) {
    if (deal.image?.publicId && isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(deal.image.publicId).catch(() => {});
    }
    data.image = getFileUrl(req, req.file);
  }
  if (data.price) data.price = Number(data.price);
  if (data.isForLife === "true" || data.isForLife === true) {
    data.isForLife = true;
    data.startDate = undefined;
    data.endDate = undefined;
  } else if (data.isForLife === "false") {
    data.isForLife = false;
  }
  Object.assign(deal, data);
  await deal.save();
  clearCacheByPrefix("/api/deals");
  res.status(200).json({ success: true, data: deal });
});

exports.deleteDeal = asyncHandler(async (req, res) => {
  const deal = await Deal.findById(req.params.id);
  if (!deal) return res.status(404).json({ success: false, message: "Deal not found" });
  if (deal.image?.publicId && isCloudinaryConfigured) {
    await cloudinary.uploader.destroy(deal.image.publicId).catch(() => {});
  }
  await deal.deleteOne();
  clearCacheByPrefix("/api/deals");
  res.status(200).json({ success: true, message: "Deal deleted" });
});
