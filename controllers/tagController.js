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
