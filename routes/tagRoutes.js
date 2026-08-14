const express = require("express");
const { getTags, createTag, updateTag, deleteTag, bulkDeleteTags } = require("../controllers/tagController");
const { protect, authorize } = require("../middleware/auth");
const { cacheMiddleware } = require("../middleware/cache");

const router = express.Router();

router.get("/", cacheMiddleware(300), getTags);
router.post("/", protect, authorize("admin", "staff"), createTag);
router.put("/:id", protect, authorize("admin", "staff"), updateTag);
router.delete("/bulk", protect, authorize("admin"), bulkDeleteTags);
router.delete("/:id", protect, authorize("admin"), deleteTag);

module.exports = router;
