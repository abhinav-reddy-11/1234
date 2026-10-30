import { Product, Store, Inventory, Order, User } from "../../models/index.js";
import { AppError } from "../../utils/AppError.js";
import {
  TIER_DISCOUNT_PERCENT, ORDER_TRANSITIONS, FULFILMENT_TYPES, getTierForSpend,
} from "../../utils/constants.js";

const MAX_QTY_PER_ITEM = 20;

// Merge duplicate lines and validate quantities. items = [{ productId, quantity }]
function normaliseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, "Your cart is empty");
  const merged = new Map();
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!it.productId || !Number.isInteger(qty) || qty < 1) {
      throw new AppError(400, "Each item needs a productId and a whole-number quantity ≥ 1");
    }
    merged.set(String(it.productId), (merged.get(String(it.productId)) || 0) + qty);
  }
  for (const [, qty] of merged) {
    if (qty > MAX_QTY_PER_ITEM) throw new AppError(400, `Maximum ${MAX_QTY_PER_ITEM} units per product`);
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

// Prices ALWAYS come from the database and the discount from the customer's
// tier in the database. Nothing price-related is read from the request.
export async function buildQuote(user, rawItems, storeId) {
  const items = normaliseItems(rawItems);
  const store = await Store.findOne({ _id: storeId, isActive: true });
  if (!store) throw new AppError(400, "Please select a valid store");

  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) }, isActive: true });
  const byId = Object.fromEntries(products.map((p) => [p._id.toString(), p]));
  const stock = await Inventory.find({ storeId, productId: { $in: products.map((p) => p._id) } });
  const qtyById = Object.fromEntries(stock.map((s) => [s.productId.toString(), s.quantity]));

  const lines = items.map(({ productId, quantity }) => {
    const p = byId[productId];
    if (!p) throw new AppError(400, `Product ${productId} is not available`);
    const available = qtyById[productId] ?? 0;
    return {
      productId: p._id, name: p.name, price: p.price, quantity,
      lineTotal: p.price * quantity, available, inStock: available >= quantity,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const discountPercent = TIER_DISCOUNT_PERCENT[user.tier] ?? 0;
  const discount = Math.round((subtotal * discountPercent) / 100);

  return {
    store: { _id: store._id, name: store.name, city: store.city },
    items: lines,
    subtotal, discountPercent, discount, total: subtotal - discount,
    tier: user.tier,
    allInStock: lines.every((l) => l.inStock),
  };
}

// Reserve stock safely. The update only matches when quantity >= requested, so two
// customers buying the last unit at the same moment can't both succeed (no overselling).
// If any line fails, lines already reserved are put back.
async function reserveStock(storeId, lines) {
  const reserved = [];
  for (const line of lines) {
    const updated = await Inventory.findOneAndUpdate(
      { storeId, productId: line.productId, quantity: { $gte: line.quantity } },
      { $inc: { quantity: -line.quantity } },
      { returnDocument: "after" }
    );
    if (!updated) {
      await releaseStock(storeId, reserved);
      throw new AppError(409, `Not enough stock for "${line.name}". Please reduce the quantity or choose another store.`);
    }
    reserved.push(line);
  }
}

export async function releaseStock(storeId, lines) {
  for (const line of lines) {
    await Inventory.updateOne({ storeId, productId: line.productId }, { $inc: { quantity: line.quantity } });
  }
}

export async function placeOrder(user, { items, storeId, fulfilment, deliveryAddress }) {
  if (!FULFILMENT_TYPES.includes(fulfilment)) throw new AppError(400, "Choose delivery or takeaway");
  if (fulfilment === "delivery" && !String(deliveryAddress || "").trim()) {
    throw new AppError(400, "Delivery address is required for delivery orders");
  }

  const quote = await buildQuote(user, items, storeId);
  const lines = quote.items.map(({ productId, name, price, quantity, lineTotal }) => ({ productId, name, price, quantity, lineTotal }));

  await reserveStock(storeId, lines);

  try {
    return await Order.create({
      customerId: user._id,
      storeId,
      items: lines,
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
      tierAtPurchase: user.tier,
      fulfilment,
      deliveryAddress: fulfilment === "delivery" ? deliveryAddress.trim() : undefined,
      status: "placed",
      statusHistory: [{ status: "placed", by: user._id }],
      payment: { method: "simulated", status: "paid" },
    });
  } catch (err) {
    await releaseStock(storeId, lines); // order failed to save -> give the stock back
    throw err;
  }
}

export function allowedNextStatuses(order) {
  return ORDER_TRANSITIONS[order.fulfilment]?.[order.status] ?? [];
}

// Move an order to a new status, following the allowed transitions.
// Side effects: cancelled -> stock returned + refund; completed -> spend added + tier recalculated.
export async function changeOrderStatus(order, newStatus, actor) {
  const allowed = allowedNextStatuses(order);
  if (!allowed.includes(newStatus)) {
    throw new AppError(400, `Cannot change status from "${order.status}" to "${newStatus}". Allowed: ${allowed.join(", ") || "none"}`);
  }
  if (actor.role === "customer" && newStatus !== "cancelled") {
    throw new AppError(403, "Customers can only cancel their orders");
  }

  // Claim the transition atomically so two clicks can't apply it twice.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: { status: newStatus }, $push: { statusHistory: { status: newStatus, by: actor._id, at: new Date() } } },
    { returnDocument: "after" }
  );
  if (!updated) throw new AppError(409, "Order was updated by someone else. Please refresh.");

  let membership = null;
  if (newStatus === "cancelled") {
    await releaseStock(updated.storeId, updated.items);
    updated.payment.status = "refunded";
    await updated.save();
  }
  if (newStatus === "completed") {
    membership = await addEligibleSpend(updated.customerId, updated.total);
  }
  return { order: updated, membership };
}

// Adds spend for a completed order and upgrades the tier if a threshold is crossed.
export async function addEligibleSpend(customerId, amount) {
  // $inc is atomic, so two orders completing at once both get counted.
  await User.updateOne({ _id: customerId }, { $inc: { totalEligibleSpend: amount } });
  const customer = await User.findById(customerId);
  if (!customer) return null;
  const newTier = getTierForSpend(customer.totalEligibleSpend);
  const upgraded = newTier !== customer.tier;
  if (upgraded) {
    customer.tier = newTier;
    await customer.save();
  }
  return { tier: customer.tier, totalEligibleSpend: customer.totalEligibleSpend, upgraded };
}
