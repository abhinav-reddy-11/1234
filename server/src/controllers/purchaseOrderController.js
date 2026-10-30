import mongoose from "mongoose";
import { PurchaseOrder, Product, Inventory, Store } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { assertStoreAccess } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";
import { PO_TRANSITIONS } from "../utils/constants.js";

const POPULATE = [
  { path: "storeId", select: "name city" },
  { path: "createdBy", select: "name email" },
  { path: "approvedBy", select: "name" },
  { path: "items.productId", select: "name price" },
];

async function loadPO(id, user) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, "Invalid purchase order id");
  const po = await PurchaseOrder.findById(id);
  if (!po) throw new AppError(404, "Purchase order not found");
  assertStoreAccess(user, po.storeId);
  return po;
}

// Move status only along the allowed lifecycle, atomically (no double approvals).
async function transition(po, to, extraSet = {}) {
  const allowed = PO_TRANSITIONS[po.status] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(400, `Cannot move purchase order from "${po.status}" to "${to}"`);
  }
  const updated = await PurchaseOrder.findOneAndUpdate(
    { _id: po._id, status: po.status },
    { $set: { status: to, ...extraSet } },
    { returnDocument: "after" }
  );
  if (!updated) throw new AppError(409, "Purchase order was changed by someone else. Please refresh.");
  return updated;
}

// POST /api/purchase-orders { items:[{productId, quantityRequested}], notes, aiSuggested, submit, storeId(admin only) }
export async function createPurchaseOrder(req, res) {
  const storeId = req.user.role === "manager" ? req.user.storeId : req.body.storeId;
  if (!storeId || !(await Store.exists({ _id: storeId }))) throw new AppError(400, "Valid storeId is required");

  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, "Add at least one product");
  for (const it of items) {
    const qty = Number(it.quantityRequested);
    if (!mongoose.isValidObjectId(it.productId) || !Number.isInteger(qty) || qty < 1 || qty > 1000) {
      throw new AppError(400, "Each item needs a valid productId and a quantity between 1 and 1000");
    }
  }
  const ids = [...new Set(items.map((i) => String(i.productId)))];
  if (ids.length !== items.length) throw new AppError(400, "Each product can appear only once");
  if ((await Product.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    throw new AppError(400, "One or more products do not exist");
  }

  const po = await PurchaseOrder.create({
    storeId,
    createdBy: req.user._id,
    items: items.map((i) => ({ productId: i.productId, quantityRequested: Number(i.quantityRequested) })),
    notes: req.body.notes,
    aiSuggested: Boolean(req.body.aiSuggested),
    status: req.body.submit ? "submitted" : "draft",
  });
  await logAudit(req.user._id, "PURCHASE_ORDER_CREATED", "PurchaseOrder", po._id, {
    status: po.status, aiSuggested: po.aiSuggested, items: po.items.length,
  });
  res.status(201).json({ success: true, purchaseOrder: await po.populate(POPULATE) });
}

// GET /api/purchase-orders?status=&storeId=   (managers: own store only)
export async function listPurchaseOrders(req, res) {
  const filter = {};
  if (req.user.role === "manager") filter.storeId = req.user.storeId;
  else if (req.query.storeId) filter.storeId = req.query.storeId;
  if (req.query.status) filter.status = req.query.status;
  const purchaseOrders = await PurchaseOrder.find(filter).populate(POPULATE).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, purchaseOrders });
}

// GET /api/purchase-orders/:id
export async function getPurchaseOrder(req, res) {
  const po = await loadPO(req.params.id, req.user);
  res.json({ success: true, purchaseOrder: await po.populate(POPULATE) });
}

// PATCH /api/purchase-orders/:id/submit   (draft -> submitted)
export async function submitPurchaseOrder(req, res) {
  const po = await transition(await loadPO(req.params.id, req.user), "submitted");
  await logAudit(req.user._id, "PURCHASE_ORDER_SUBMITTED", "PurchaseOrder", po._id);
  res.json({ success: true, purchaseOrder: await po.populate(POPULATE) });
}

// PATCH /api/purchase-orders/:id/approve   (admin only: submitted -> approved)
export async function approvePurchaseOrder(req, res) {
  const po = await transition(await loadPO(req.params.id, req.user), "approved", {
    approvedBy: req.user._id, approvedAt: new Date(),
  });
  await logAudit(req.user._id, "PURCHASE_ORDER_APPROVED", "PurchaseOrder", po._id);
  res.json({ success: true, purchaseOrder: await po.populate(POPULATE) });
}

// PATCH /api/purchase-orders/:id/reject { reason }   (admin only: submitted -> rejected)
export async function rejectPurchaseOrder(req, res) {
  const reason = String(req.body.reason || "").trim();
  if (!reason) throw new AppError(400, "A rejection reason is required");
  const po = await transition(await loadPO(req.params.id, req.user), "rejected", { rejectionReason: reason });
  await logAudit(req.user._id, "PURCHASE_ORDER_REJECTED", "PurchaseOrder", po._id, { reason });
  res.json({ success: true, purchaseOrder: await po.populate(POPULATE) });
}

// POST /api/purchase-orders/:id/receive { items?: [{productId, quantityReceived}] }
// Records goods received (approved -> received). THIS is the only place stock increases
// from restocking. If items are omitted, everything requested is assumed received.
export async function receivePurchaseOrder(req, res) {
  const po = await loadPO(req.params.id, req.user);
  if (po.status !== "approved") throw new AppError(400, "Only approved purchase orders can be received");

  const received = new Map(
    (req.body.items ?? po.items.map((i) => ({ productId: i.productId, quantityReceived: i.quantityRequested })))
      .map((i) => [String(i.productId), Number(i.quantityReceived)])
  );
  const items = po.items.map((i) => {
    const qty = received.get(i.productId.toString()) ?? 0;
    if (!Number.isInteger(qty) || qty < 0 || qty > i.quantityRequested) {
      throw new AppError(400, `Received quantity must be between 0 and ${i.quantityRequested}`);
    }
    return { productId: i.productId, quantityRequested: i.quantityRequested, quantityReceived: qty };
  });

  // Mark received first (atomic), so the stock can never be added twice.
  const updated = await transition(po, "received", { items, receivedAt: new Date() });

  for (const item of items.filter((i) => i.quantityReceived > 0)) {
    await Inventory.updateOne(
      { storeId: po.storeId, productId: item.productId },
      { $inc: { quantity: item.quantityReceived }, $setOnInsert: { reorderLevel: 10 } },
      { upsert: true }
    );
  }
  await logAudit(req.user._id, "PURCHASE_ORDER_RECEIVED", "PurchaseOrder", po._id, {
    units: items.reduce((s, i) => s + i.quantityReceived, 0),
  });
  res.json({ success: true, purchaseOrder: await updated.populate(POPULATE) });
}
