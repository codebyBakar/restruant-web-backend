const express = require("express");
const {
  getCategories,
  getCategory,
  getCategoryOrderStats,
  getCategoryProductStats,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} = require("../controllers/categoryController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const validate = require("../middleware/validate");
const { cacheMiddleware } = require("../middleware/cache");
const { slugParam, categoryList } = require("../middleware/validators");

const router = express.Router();

router.get("/", [...categoryList], validate, cacheMiddleware(300), getCategories);
router.get("/stats/orders", protect, authorize("admin", "staff"), getCategoryOrderStats);
router.get("/stats/products", protect, authorize("admin", "staff"), getCategoryProductStats);
router.get("/:slug", slugParam("slug"), validate, cacheMiddleware(300), getCategory);

router.post(
  "/",
  protect,
  authorize("admin", "staff"),
  upload.handleUpload(upload.single("image")),
  createCategory
);

router.put("/reorder", protect, authorize("admin", "staff"), reorderCategories);
router.put("/:id", protect, authorize("admin", "staff"), upload.handleUpload(upload.single("image")), updateCategory);
router.delete("/:id", protect, authorize("admin"), deleteCategory);

module.exports = router;
