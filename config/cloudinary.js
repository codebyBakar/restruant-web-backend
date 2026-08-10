const path = require("path");
const fs = require("fs");
const multer = require("multer");

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== "your_api_key" &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_API_SECRET !== "your_api_secret";

let cloudinary = null;
let storage = null;

if (isCloudinaryConfigured) {
  cloudinary = require("cloudinary").v2;
  const { CloudinaryStorage } = require("multer-storage-cloudinary");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "pratha-restaurant",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto" }],
    },
  });
  console.log("Cloudinary configured — using cloud storage");
} else {
  const uploadDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      cb(null, unique + path.extname(file.originalname || ".jpg"));
    },
  });
  console.log("Cloudinary not configured — using local file storage");
}

const getFileUrl = (req, file) => {
  if (isCloudinaryConfigured) {
    return { url: file.path, publicId: file.filename };
  }
  const base = `${req.protocol}://${req.get("host")}`;
  return { url: `${base}/uploads/${file.filename}`, publicId: file.filename };
};

module.exports = { cloudinary, storage, getFileUrl, isCloudinaryConfigured };
