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

// Keep only items that reference an existing product — null products (deleted
// products left in an old deal) would otherwise fail validation with a 400.
const sanitizeDealItems = (items) =>
  (Array.isArray(items) ? items : []).filter((it) => it && it.product).map((it) => ({ ...it, quantity: Number(it.quantity) }));

exports.createDeal = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (typeof data.items === "string") {
    try {
      data.items = sanitizeDealItems(JSON.parse(data.items));
    } catch {
      data.items = [];
    }
  } else {
    data.items = sanitizeDealItems(data.items);
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
      data.items = sanitizeDealItems(JSON.parse(data.items));
    } catch {
      data.items = [];
    }
  } else if (data.items !== undefined) {
    data.items = sanitizeDealItems(data.items);
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

exports.bulkDeleteDeals = asyncHandler(async (req, res) => {
  const { ids, all } = req.body;

  let query = null;
  if (all) {
    query = {};
  } else if (Array.isArray(ids) && ids.length > 0) {
    const validIds = ids.filter((id) => /^[0-9a-fA-F]{24}$/.test(String(id)));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: "No valid deals selected" });
    }
    query = { _id: { $in: validIds } };
  } else {
    return res.status(400).json({ success: false, message: "No deals selected" });
  }

  const deals = await Deal.find(query).select("image");
  if (isCloudinaryConfigured) {
    for (const deal of deals) {
      if (deal.image?.publicId) await cloudinary.uploader.destroy(deal.image.publicId).catch(() => {});
    }
  }

  const result = await Deal.deleteMany(query);
  clearCacheByPrefix("/api/deals");
  res.status(200).json({ success: true, deleted: result.deletedCount, message: `${result.deletedCount} deal(s) deleted` });
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
