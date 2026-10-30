import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // min: 0 -> stock can never go negative
    quantity: { type: Number, required: true, min: 0, default: 0 },
    // Low stock when quantity <= reorderLevel
    reorderLevel: { type: Number, required: true, min: 0, default: 10 },
  },
  { timestamps: true } // gives updatedAt
);

// One inventory record per product per store.
inventorySchema.index({ storeId: 1, productId: 1 }, { unique: true });

inventorySchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.reorderLevel;
});
inventorySchema.set("toJSON", { virtuals: true });

export default mongoose.model("Inventory", inventorySchema);
