const asyncHandler = require("../middleware/asyncHandler");
const Settings = require("../models/Settings");
const { cloudinary, getFileUrl, isCloudinaryConfigured } = require("../config/cloudinary");
const { clearCacheByPrefix } = require("../middleware/cache");

exports.getSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne({ key: "site" });
  if (!settings) settings = await Settings.create({ key: "site" });
  res.status(200).json({ success: true, data: settings });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne({ key: "site" });
  if (!settings) settings = await Settings.create({ key: "site" });

  const data = { ...req.body };
  if (data.socialLinks && typeof data.socialLinks === "string") {
    data.socialLinks = JSON.parse(data.socialLinks);
  }

  if (data.storeStatus && typeof data.storeStatus === "string") {
    data.storeStatus = JSON.parse(data.storeStatus);
  }

  const socialKeys = ["facebook", "instagram", "tiktok"];
  if (socialKeys.some((k) => data[k] !== undefined)) {
    data.socialLinks = {
      ...(settings.socialLinks || {}),
      ...socialKeys.reduce((acc, k) => {
        if (data[k] !== undefined) acc[k] = data[k];
        return acc;
      }, {}),
    };
    socialKeys.forEach((k) => delete data[k]);
  }

  if (req.files?.heroImage?.[0]) {
    if (settings.heroImage?.publicId && isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(settings.heroImage.publicId).catch(() => {});
    }
    data.heroImage = getFileUrl(req, req.files.heroImage[0]);
  }

  if (req.files?.logo?.[0]) {
    if (settings.logo?.publicId && isCloudinaryConfigured) {
      await cloudinary.uploader.destroy(settings.logo.publicId).catch(() => {});
    }
    data.logo = getFileUrl(req, req.files.logo[0]);
  }

  if (req.files?.gallery?.length) {
    const newImgs = req.files.gallery.map((f) => getFileUrl(req, f));
    data.gallery = [...(settings.gallery || []), ...newImgs];
  }

  Object.assign(settings, data);
  await settings.save();
  clearCacheByPrefix("/api/settings");
  res.status(200).json({ success: true, data: settings });
});

exports.deleteGalleryImage = asyncHandler(async (req, res) => {
  const settings = await Settings.findOne({ key: "site" });
  if (!settings) return res.status(404).json({ success: false, message: "Settings not found" });

  const publicId = decodeURIComponent(req.params.publicId);
  settings.gallery = settings.gallery.filter((img) => img.publicId !== publicId);
  if (isCloudinaryConfigured) {
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
  await settings.save();
  clearCacheByPrefix("/api/settings");
  res.status(200).json({ success: true, data: settings });
});
