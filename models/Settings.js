const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "site", unique: true },
    siteName: { type: String, default: "Pratha" },
    tagline: { type: String, default: "Authentic Parathas, Made With Love" },
    currency: { type: String, default: "Rs." },
    logo: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    heroImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    gallery: [
      {
        url: String,
        publicId: String,
      },
    ],
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    openingHours: { type: String, default: "11:00 AM - 11:00 PM, All Days" },
    deliveryFee: { type: Number, default: 100 },
    freeDeliveryThreshold: { type: Number, default: 1500 },
    taxPercent: { type: Number, default: 5 },
    minOrderAmount: { type: Number, default: 300 },
    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },
    totalTables: { type: Number, default: 12 },
    storeStatus: {
      mode: { type: String, enum: ["auto", "manual"], default: "auto" },
      manualOpen: { type: Boolean, default: true },
      timezone: { type: String, default: "Asia/Karachi" },
      openTime: { type: String, default: "11:00" },
      closeTime: { type: String, default: "23:00" },
      closedMessage: { type: String, default: "" },
    },
    bankName: { type: String, default: "" },
    bankAccountTitle: { type: String, default: "" },
    bankAccountNumber: { type: String, default: "" },
    bankIBAN: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
