import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User, Store, Order, PurchaseOrder, PolicyDocument, AuditLog, Inventory } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { requireFields, validatePassword } from "../utils/validate.js";
import { logAudit } from "../utils/audit.js";

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const PENDING = ["placed", "packed", "out_for_delivery", "ready_for_pickup"];
const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

// ---------- Users ----------

// GET /api/admin/users?role=
export async function listUsers(req, res) {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).populate("storeId", "name city").sort({ role: 1, name: 1 });
  res.json({ success: true, users });
}

// POST /api/admin/users { name, email, password, role: "manager"|"admin", storeId }
export async function createStaffUser(req, res) {
  requireFields(req.body, ["name", "email", "password", "role"]);
  const { name, email, password, role, storeId } = req.body;
  if (!["manager", "admin"].includes(role)) throw new AppError(400, "Role must be manager or admin");
  validatePassword(password);
  if (role === "manager" && !(await Store.exists({ _id: storeId }))) throw new AppError(400, "Valid storeId required for managers");

  const user = await User.create({
    name, email, role, storeId: role === "manager" ? storeId : undefined,
    passwordHash: await bcrypt.hash(password, 10),
  });
  await logAudit(req.user._id, "STAFF_USER_CREATED", "User", user._id, { role, storeId });
  res.status(201).json({ success: true, user });
}

// PATCH /api/admin/users/:id { isActive, storeId }
export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, "User not found");
  if (user._id.equals(req.user._id) && req.body.isActive === false) throw new AppError(400, "You cannot disable your own account");

  const changes = {};
  if (req.body.isActive !== undefined) changes.isActive = user.isActive = Boolean(req.body.isActive);
  if (req.body.storeId !== undefined) {
    if (user.role !== "manager") throw new AppError(400, "Only managers are assigned to stores");
    if (!(await Store.exists({ _id: req.body.storeId }))) throw new AppError(400, "Store not found");
    changes.storeId = user.storeId = req.body.storeId;
  }
  await user.save();
  await logAudit(req.user._id, "USER_UPDATED", "User", user._id, changes);
  res.json({ success: true, user: await user.populate("storeId", "name city") });
}

// ---------- Dashboards ----------

// GET /api/admin/dashboard — organisation-wide numbers.
export async function adminDashboard(req, res) {
  const today = startOfToday();
  const [stores, todaysOrders, pendingOrders, completed, inventory, poCounts, pendingPolicies, customers] = await Promise.all([
    Store.find({}, "name city").lean(),
    Order.find({ createdAt: { $gte: today } }, "storeId total status").lean(),
    Order.countDocuments({ status: { $in: PENDING } }),
    Order.find({ status: "completed" }, "total").lean(),
    Inventory.find({}, "storeId quantity reorderLevel").lean(),
    PurchaseOrder.find({ status: { $in: ["submitted", "approved"] } }, "status").lean(),
    PolicyDocument.countDocuments({ status: "pending" }),
    User.find({ role: "customer" }, "tier").lean(),
  ]);

  const perStore = stores.map((s) => {
    const id = s._id.toString();
    const ordersHere = todaysOrders.filter((o) => o.storeId.toString() === id);
    return {
      storeId: s._id, name: s.name, city: s.city,
      ordersToday: ordersHere.length,
      revenueToday: sum(ordersHere.filter((o) => o.status !== "cancelled"), "total"),
      lowStock: inventory.filter((i) => i.storeId.toString() === id && i.quantity <= i.reorderLevel).length,
    };
  });

  res.json({
    success: true,
    dashboard: {
      ordersToday: todaysOrders.length,
      revenueToday: sum(todaysOrders.filter((o) => o.status !== "cancelled"), "total"),
      pendingOrders,
      completedRevenue: sum(completed, "total"),
      lowStockItems: inventory.filter((i) => i.quantity <= i.reorderLevel).length,
      purchaseOrdersAwaitingApproval: poCounts.filter((p) => p.status === "submitted").length,
      purchaseOrdersAwaitingReceipt: poCounts.filter((p) => p.status === "approved").length,
      pendingPolicies,
      customersByTier: {
        bronze: customers.filter((c) => c.tier === "bronze").length,
        silver: customers.filter((c) => c.tier === "silver").length,
        gold: customers.filter((c) => c.tier === "gold").length,
      },
      perStore,
    },
  });
}

// GET /api/manager/dashboard — the manager's own store only.
export async function managerDashboard(req, res) {
  const storeId = req.user.storeId;
  const today = startOfToday();
  const [store, todaysOrders, pending, inventory, pos] = await Promise.all([
    Store.findById(storeId, "name city address").lean(),
    Order.find({ storeId, createdAt: { $gte: today } }, "total status fulfilment").lean(),
    Order.find({ storeId, status: { $in: PENDING } }, "fulfilment status").lean(),
    Inventory.find({ storeId }, "quantity reorderLevel").lean(),
    PurchaseOrder.find({ storeId, status: { $in: ["draft", "submitted", "approved"] } }, "status").lean(),
  ]);
  res.json({
    success: true,
    dashboard: {
      store,
      ordersToday: todaysOrders.length,
      revenueToday: sum(todaysOrders.filter((o) => o.status !== "cancelled"), "total"),
      pendingOrders: pending.length,
      pendingDelivery: pending.filter((o) => o.fulfilment === "delivery").length,
      pendingTakeaway: pending.filter((o) => o.fulfilment === "takeaway").length,
      lowStockItems: inventory.filter((i) => i.quantity <= i.reorderLevel).length,
      outOfStockItems: inventory.filter((i) => i.quantity === 0).length,
      openPurchaseOrders: {
        draft: pos.filter((p) => p.status === "draft").length,
        submitted: pos.filter((p) => p.status === "submitted").length,
        approved: pos.filter((p) => p.status === "approved").length,
      },
    },
  });
}

// ---------- Audit log ----------

// GET /api/audit?entity=&action=&limit=
export async function listAuditLogs(req, res) {
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.entityId && mongoose.isValidObjectId(req.query.entityId)) filter.entityId = req.query.entityId;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await AuditLog.find(filter).populate("actorId", "name email role").sort({ timestamp: -1 }).limit(limit);
  res.json({ success: true, logs });
}
