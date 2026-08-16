const mongoose = require("mongoose");
const slugify = require("slugify");

const variantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // e.g. "Small", "Regular", "Family"
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    ingredients: [{ type: String }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    basePrice: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: null, min: 0 },
    variants: [variantSchema],
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    isVeg: { type: Boolean, default: true },
    spiceLevel: { type: String, enum: ["none", "mild", "medium", "hot"], default: "none" },
    calories: { type: Number },
    prepTimeMinutes: { type: Number, default: 20 },
    isAvailable: { type: Boolean, default: true },
    // Badge shown on the user side when a product is unavailable:
    // "coming_soon" → COMING SOON badge, "unavailable" → SOLD OUT badge, "" → no badge.
    unavailableBadge: { type: String, enum: ["", "coming_soon", "unavailable"], default: "" },
    isFeatured: { type: Boolean, default: false },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });

productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true }) + "-" + Math.random().toString(36).slice(2, 7);
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
