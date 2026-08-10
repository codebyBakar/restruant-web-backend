const asyncHandler = require("../middleware/asyncHandler");
const Contact = require("../models/contact");
const Settings = require("../models/Settings");
const { clearCacheByPrefix } = require("../middleware/cache");
const { sendContactAckEmail, sendContactAdminEmail } = require("../utils/email");

// @desc Submit a contact form message (public)
// @route POST /api/contact
exports.createContactMessage = asyncHandler(async (req, res) => {
  const { name, email, phone = "", subject = "", message } = req.body;

  const contact = await Contact.create({ name, email, phone, subject, message });

  clearCacheByPrefix("/api/contact");

  const settings = (await Settings.findOne({ key: "site" })) || {};
  const siteName = settings.siteName || "Pratha";
  const adminTo =
    process.env.CONTACT_ADMIN_EMAIL ||
    settings.email ||
    process.env.ADMIN_EMAIL ||
    process.env.SMTP_USER;

  Promise.all([
    sendContactAckEmail(contact, siteName, settings.logo?.url || ""),
    sendContactAdminEmail(contact, siteName, adminTo),
  ]).catch((err) => console.error("[Email] Contact email error:", err.message || err));

  res.status(201).json({
    success: true,
    message: "Thank you! Your message has been sent. We'll get back to you soon.",
    data: contact,
  });
});

// @desc Get contact messages (admin) with pagination + read filter
// @route GET /api/contact
exports.getContactMessages = asyncHandler(async (req, res) => {
  const { read, page = 1, limit = 20 } = req.query;
  const query = {};
  if (read !== undefined) query.isRead = read === "true";

  const pageNum = Math.max(parseInt(page, 10), 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);

  const [messages, total, unread] = await Promise.all([
    Contact.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Contact.countDocuments(query),
    Contact.countDocuments({ isRead: false }),
  ]);

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    unread,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: messages,
  });
});

// @desc Mark a contact message as read/unread (admin)
// @route PUT /api/contact/:id/read
exports.markContactRead = asyncHandler(async (req, res) => {
  const message = await Contact.findById(req.params.id);
  if (!message) return res.status(404).json({ success: false, message: "Message not found" });

  message.isRead = req.body.isRead;
  await message.save();

  clearCacheByPrefix("/api/contact");
  res.status(200).json({ success: true, data: message });
});

// @desc Delete a contact message (admin)
// @route DELETE /api/contact/:id
exports.deleteContactMessage = asyncHandler(async (req, res) => {
  const message = await Contact.findById(req.params.id);
  if (!message) return res.status(404).json({ success: false, message: "Message not found" });

  await message.deleteOne();
  clearCacheByPrefix("/api/contact");
  res.status(200).json({ success: true, message: "Message deleted" });
});
