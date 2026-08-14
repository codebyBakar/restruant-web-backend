const asyncHandler = require("../middleware/asyncHandler");
const Tag = require("../models/Tag");
const { clearCacheByPrefix } = require("../middleware/cache");

exports.getTags = asyncHandler(async (req, res) => {
  const tags = await Tag.find().sort({ name: 1 });
  res.status(200).json({ success: true, count: tags.length, data: tags });
});

exports.createTag = asyncHandler(async (req, res) => {
  const tag = await Tag.create(req.body);
  clearCacheByPrefix("/api/tags");
  res.status(201).json({ success: true, data: tag });
});

exports.updateTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!tag) return res.status(404).json({ success: false, message: "Tag not found" });
  clearCacheByPrefix("/api/tags");
  res.status(200).json({ success: true, data: tag });
});

exports.deleteTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findByIdAndDelete(req.params.id);
  if (!tag) return res.status(404).json({ success: false, message: "Tag not found" });
  clearCacheByPrefix("/api/tags");
  res.status(200).json({ success: true, message: "Tag deleted" });
});

exports.bulkDeleteTags = asyncHandler(async (req, res) => {
  const { ids, all } = req.body;

  let query = null;
  if (all) {
    query = {};
  } else if (Array.isArray(ids) && ids.length > 0) {
    const validIds = ids.filter((id) => /^[0-9a-fA-F]{24}$/.test(String(id)));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: "No valid tags selected" });
    }
    query = { _id: { $in: validIds } };
  } else {
    return res.status(400).json({ success: false, message: "No tags selected" });
  }

  const result = await Tag.deleteMany(query);
  clearCacheByPrefix("/api/tags");
  res.status(200).json({ success: true, deleted: result.deletedCount, message: `${result.deletedCount} tag(s) deleted` });
});
