const express = require("express");
const {
  createOrder,
  createOnlineOrder,
  trackOrder,
  getMyOrders,
  getOrders,
  getRecentOrders,
  getOrder,
  updateOrderStatus,
  deleteOrder,
  bulkDeleteOrders,
  deleteMyOrder,
  getDashboardStats,
  uploadPaymentScreenshot,
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const upload = require("../middleware/upload");
const { handleUpload } = upload;
const { createOrder: createOrderV, trackOrder: trackOrderV, myOrders: myOrdersV, uploadScreenshot: uploadScreenshotV } = require("../middleware/validators");

const router = express.Router();

// Multipart body arrives with JSON-encoded fields as strings; decode them so the
// shared order validators can inspect the nested structure before validation.
const parseOrderBody = (req, res, next) => {
  try {
    if (typeof req.body?.customer === "string") req.body.customer = JSON.parse(req.body.customer);
    if (typeof req.body?.deliveryAddress === "string" && req.body.deliveryAddress) req.body.deliveryAddress = JSON.parse(req.body.deliveryAddress);
    if (typeof req.body?.items === "string") req.body.items = JSON.parse(req.body.items);
    next();
  } catch {
    return res.status(400).json({ success: false, message: "Validation failed", errors: [{ field: "body", message: "Invalid JSON in order fields" }] });
  }
};

router.post("/", createOrderV, validate, createOrder);
router.post("/online", handleUpload(upload.single("screenshot")), parseOrderBody, createOrderV, validate, createOnlineOrder);
router.post("/:orderNumber/screenshot", uploadScreenshotV, validate, handleUpload(upload.single("screenshot")), uploadPaymentScreenshot);
router.get("/track/:orderNumber", trackOrderV, validate, trackOrder);
router.get("/my-orders", myOrdersV, validate, getMyOrders);
router.delete("/my/:orderNumber", trackOrderV, validate, deleteMyOrder);

router.get("/", protect, authorize("admin", "staff"), getOrders);
router.get("/stats/dashboard", protect, authorize("admin", "staff"), getDashboardStats);
router.get("/recent", protect, authorize("admin", "staff"), getRecentOrders);
router.get("/:id", protect, authorize("admin", "staff"), getOrder);
router.put("/:id/status", protect, authorize("admin", "staff"), updateOrderStatus);
router.delete("/bulk", protect, authorize("admin"), bulkDeleteOrders);
router.delete("/:id", protect, authorize("admin"), deleteOrder);

module.exports = router;
