const express = require("express");
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  bulkDeleteProducts,
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const validate = require("../middleware/validate");
const { cacheMiddleware } = require("../middleware/cache");
const { slugParam, productList } = require("../middleware/validators");

const router = express.Router();

router.get("/", [...productList], validate, cacheMiddleware(120), getProducts);
router.get("/:slug", slugParam("slug"), validate, cacheMiddleware(120), getProduct);

router.post(
  "/",
  protect,
  authorize("admin", "staff"),
  upload.handleUpload(upload.array("images", 6)),
  createProduct
);

router.put("/:id", protect, authorize("admin", "staff"), upload.handleUpload(upload.array("images", 6)), updateProduct);
router.delete("/bulk", protect, authorize("admin"), bulkDeleteProducts);
router.delete("/:id", protect, authorize("admin"), deleteProduct);
router.delete("/:id/images/:publicId", protect, authorize("admin", "staff"), deleteProductImage);

module.exports = router;
