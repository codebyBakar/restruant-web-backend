const express = require("express");
const {
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
} = require("../controllers/dealController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const validate = require("../middleware/validate");
const { cacheMiddleware } = require("../middleware/cache");
const { dealList, objectIdParam } = require("../middleware/validators");

const router = express.Router();

router.get("/", [...dealList], validate, cacheMiddleware(60), getDeals);
router.get("/:id", objectIdParam("id"), validate, getDeal);

router.post(
  "/",
  protect,
  authorize("admin", "staff"),
  upload.handleUpload(upload.single("image")),
  createDeal
);
router.put("/:id", protect, authorize("admin", "staff"), upload.handleUpload(upload.single("image")), updateDeal);
router.delete("/:id", protect, authorize("admin"), deleteDeal);

module.exports = router;
