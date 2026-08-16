const multer = require("multer");
const { storage } = require("../config/cloudinary");
const logger = require("../utils/logger");

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // SVG files are a security risk (can contain embedded scripts), so reject them.
    if (file.mimetype === "image/svg+xml" || /\.svg$/i.test(file.originalname || "")) {
      const err = new Error("SVG files are not allowed");
      err.clientSafe = true;
      return cb(err, false);
    }
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const handleUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (err) {
      logger.error(req, err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: "Image too large. Maximum size is 5MB." });
      }
      // Errors marked clientSafe carry a message meant for the user (e.g. "SVG files are not allowed").
      if (err.clientSafe) {
        return res.status(400).json({ success: false, message: err.message });
      }
      const message = err.message?.toLowerCase().includes("cloud")
        ? "Image upload failed: Cloudinary credentials are invalid. Set correct CLOUDINARY_* env vars or keep placeholders to use local storage."
        : "Image upload failed. Please try again.";
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

module.exports = upload;
module.exports.handleUpload = handleUpload;
