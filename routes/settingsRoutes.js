const express = require("express");
const { getSettings, updateSettings, deleteGalleryImage } = require("../controllers/settingsController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { cacheMiddleware } = require("../middleware/cache");

const router = express.Router();

router.get("/", cacheMiddleware(300), getSettings);
router.put(
  "/",
  protect,
  authorize("admin"),
  upload.handleUpload(upload.fields([
    { name: "heroImage", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ])),
  updateSettings
);
router.delete("/gallery/:publicId", protect, authorize("admin"), deleteGalleryImage);

module.exports = router;
