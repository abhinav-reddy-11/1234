import mongoose from "mongoose";
import { PO_STATUS } from "../utils/constants.js";

const poItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantityRequested: { type: Number, required: true, min: 1 },
    quantityReceived: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// Lifecycle: draft -> submitted -> approved -> received (or submitted -> rejected).
// Inventory increases only at "received".
const purchaseOrderSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [poItemSchema],
      validate: [(items) => items.length > 0, "Purchase order must have at least one item"],
    },
    status: { type: String, enum: PO_STATUS, default: "draft" },
    notes: { type: String, trim: true, default: "" },
    aiSuggested: { type: Boolean, default: false }, // created from an AI restock suggestion

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    receivedAt: { type: Date },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ storeId: 1, status: 1, createdAt: -1 });

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
