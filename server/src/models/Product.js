import mongoose from "mongoose";

// The product catalogue is shared by all stores. Stock lives in Inventory, per store.
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    price: { type: Number, required: true, min: 0 }, // in ₹
    // Free-form specs used for comparison, e.g. { brand: "Acme", ram: "8 GB" }
    attributes: { type: Map, of: String, default: {} },
    tags: [{ type: String, trim: true, lowercase: true }],
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Search uses a case-insensitive regex on name/tags (fine for a small demo catalogue).
productSchema.index({ category: 1, price: 1 }); // category filter + price sort

export default mongoose.model("Product", productSchema);
