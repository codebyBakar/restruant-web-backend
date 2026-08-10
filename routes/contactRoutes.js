const express = require("express");
const {
  createContactMessage,
  getContactMessages,
  markContactRead,
  deleteContactMessage,
} = require("../controllers/contactController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  createContact,
  contactList,
  updateContactRead,
  objectIdParam,
} = require("../middleware/validators");

const router = express.Router();

router.post("/", createContact, validate, createContactMessage);

router.get("/", protect, authorize("admin", "staff"), contactList, validate, getContactMessages);
router.put("/:id/read", protect, authorize("admin", "staff"), objectIdParam("id"), updateContactRead, validate, markContactRead);
router.delete("/:id", protect, authorize("admin"), objectIdParam("id"), deleteContactMessage);

module.exports = router;