import mongoose from "mongoose";

// Append-only record of important actions (approvals, status changes, uploads...).
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true }, // e.g. "PURCHASE_ORDER_APPROVED"
  entity: { type: String, required: true }, // e.g. "PurchaseOrder"
  entityId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

export default mongoose.model("AuditLog", auditLogSchema);
