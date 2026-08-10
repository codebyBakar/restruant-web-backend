const mongoose = require("mongoose");

const dealItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    items: [dealItemSchema],
    isForLife: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dealSchema.pre("save", function (next) {
  if (this.endDate && new Date(this.endDate) < new Date()) {
    this.isActive = false;
  }
  next();
});

module.exports = mongoose.model("Deal", dealSchema);
