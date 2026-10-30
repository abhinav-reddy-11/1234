import { AuditLog } from "../models/index.js";

// Record an important action. Audit failures are logged but never break the main request.
export async function logAudit(actorId, action, entity, entityId, details = {}) {
  try {
    await AuditLog.create({ actorId, action, entity, entityId, details });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}
