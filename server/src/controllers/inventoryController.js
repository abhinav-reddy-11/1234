import { Inventory, Store } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { assertStoreAccess } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

// Low stock rule from the spec: quantity <= reorderLevel
const isLow = (item) => item.quantity <= item.reorderLevel;

// GET /api/inventory/:storeId?lowStock=true
// Customers: read-only stock list. Managers: own store only. Admins: any store.
export async function getStoreInventory(req, res) {
  const { storeId } = req.params;
  if (req.user.role === "manager") assertStoreAccess(req.user, storeId);
  if (!(await Store.exists({ _id: storeId }))) throw new AppError(404, "Store not found");

  const items = await Inventory.find({ storeId })
    .populate({ path: "productId", select: "name price category isActive", populate: { path: "category", select: "name" } })
    .sort({ quantity: 1 });

  let inventory = items
    .filter((i) => i.productId) // skip records whose product was deleted
    .map((i) => ({
      _id: i._id,
      product: i.productId,
      quantity: i.quantity,
      reorderLevel: i.reorderLevel,
      isLowStock: isLow(i),
      updatedAt: i.updatedAt,
    }));

  const lowStockCount = inventory.filter((i) => i.isLowStock).length;
  if (req.query.lowStock === "true") inventory = inventory.filter((i) => i.isLowStock);

  res.json({ success: true, storeId, lowStockCount, inventory });
}

// GET /api/inventory  (admin) — organisation-wide summary per store.
export async function getInventorySummary(req, res) {
  const [stores, records] = await Promise.all([
    Store.find({}, "name city isActive").lean(),
    Inventory.find({}, "storeId quantity reorderLevel").lean(),
  ]);
  const summary = stores.map((s) => {
    const mine = records.filter((r) => r.storeId.toString() === s._id.toString());
    return {
      storeId: s._id, name: s.name, city: s.city, isActive: s.isActive,
      products: mine.length,
      totalUnits: mine.reduce((sum, r) => sum + r.quantity, 0),
      lowStock: mine.filter(isLow).length,
      outOfStock: mine.filter((r) => r.quantity === 0).length,
    };
  });
  res.json({ success: true, stores: summary });
}

// PATCH /api/inventory/item/:id  { reorderLevel }  — manager (own store) or admin.
// Quantity is NOT editable here: stock changes only through orders and received purchase orders,
// so every unit can be traced. Admins may correct quantity with { quantity, reason }.
export async function updateInventoryItem(req, res) {
  const item = await Inventory.findById(req.params.id);
  if (!item) throw new AppError(404, "Inventory record not found");
  assertStoreAccess(req.user, item.storeId);

  const changes = {};
  if (req.body.reorderLevel !== undefined) {
    const level = Number(req.body.reorderLevel);
    if (!Number.isInteger(level) || level < 0) throw new AppError(400, "reorderLevel must be a whole number ≥ 0");
    changes.reorderLevel = item.reorderLevel = level;
  }
  if (req.body.quantity !== undefined) {
    if (req.user.role !== "admin") throw new AppError(403, "Only admins can correct stock quantity");
    if (!req.body.reason) throw new AppError(400, "A reason is required for a stock correction");
    const qty = Number(req.body.quantity);
    if (!Number.isInteger(qty) || qty < 0) throw new AppError(400, "quantity must be a whole number ≥ 0");
    changes.quantity = { from: item.quantity, to: qty, reason: req.body.reason };
    item.quantity = qty;
  }
  if (!Object.keys(changes).length) throw new AppError(400, "Nothing to update");

  await item.save();
  await logAudit(req.user._id, "INVENTORY_UPDATED", "Inventory", item._id, changes);
  res.json({ success: true, item });
}
