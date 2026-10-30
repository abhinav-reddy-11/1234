import mongoose from "mongoose";
import { Order, User } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { assertOwnership, assertStoreAccess } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";
import { buildQuote, placeOrder, changeOrderStatus, allowedNextStatuses } from "../services/orders/orderService.js";
import { ORDER_STATUS } from "../utils/constants.js";

const withNext = (order) => ({ ...order.toJSON(), allowedNextStatuses: allowedNextStatuses(order) });

// POST /api/orders/quote { storeId, items? }  — price preview for the checkout page.
// If items are not sent, the customer's saved cart is used.
export async function quoteOrder(req, res) {
  const items = req.body.items ?? req.user.cart;
  const quote = await buildQuote(req.user, items, req.body.storeId);
  res.json({ success: true, quote });
}

// POST /api/orders { storeId, fulfilment, deliveryAddress, items? }
export async function createOrder(req, res) {
  const usingCart = !req.body.items;
  const order = await placeOrder(req.user, {
    items: req.body.items ?? req.user.cart,
    storeId: req.body.storeId,
    fulfilment: req.body.fulfilment,
    deliveryAddress: req.body.deliveryAddress,
  });
  if (usingCart) await User.updateOne({ _id: req.user._id }, { $set: { cart: [] } });

  await logAudit(req.user._id, "ORDER_PLACED", "Order", order._id, { total: order.total, storeId: order.storeId });
  res.status(201).json({ success: true, message: "Order placed. Payment simulated successfully.", order: withNext(order) });
}

// GET /api/orders/my
export async function getMyOrders(req, res) {
  const orders = await Order.find({ customerId: req.user._id })
    .populate("storeId", "name city")
    .sort({ createdAt: -1 });
  res.json({ success: true, orders: orders.map(withNext) });
}

// GET /api/orders/:id  — customer (own), manager (own store), admin (any)
export async function getOrder(req, res) {
  const order = await Order.findById(req.params.id).populate("storeId", "name city").populate("customerId", "name email tier");
  if (!order) throw new AppError(404, "Order not found");
  checkOrderAccess(req.user, order);
  res.json({ success: true, order: withNext(order) });
}

// GET /api/orders?storeId=&status=&fulfilment=&today=true  — managers are locked to their store.
export async function listOrders(req, res) {
  const { status, fulfilment, today } = req.query;
  const filter = {};

  if (req.user.role === "manager") filter.storeId = req.user.storeId;
  else if (req.query.storeId) filter.storeId = req.query.storeId;

  if (status === "pending") filter.status = { $in: ["placed", "packed", "out_for_delivery", "ready_for_pickup"] };
  else if (status && ORDER_STATUS.includes(status)) filter.status = status;
  if (fulfilment) filter.fulfilment = fulfilment;
  if (today === "true") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    filter.createdAt = { $gte: start };
  }

  const orders = await Order.find(filter)
    .populate("storeId", "name city")
    .populate("customerId", "name email tier")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, orders: orders.map(withNext) });
}

// PATCH /api/orders/:id/status { status }
export async function updateOrderStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, "Invalid order id");
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError(404, "Order not found");
  checkOrderAccess(req.user, order);

  const { order: updated, membership } = await changeOrderStatus(order, req.body.status, req.user);
  await logAudit(req.user._id, "ORDER_STATUS_CHANGED", "Order", order._id, { from: order.status, to: updated.status });
  if (membership?.upgraded) {
    await logAudit(req.user._id, "MEMBERSHIP_UPGRADED", "User", updated.customerId, { tier: membership.tier });
  }
  res.json({ success: true, order: withNext(updated), membership });
}

function checkOrderAccess(user, order) {
  const customerId = order.customerId?._id ?? order.customerId;
  const storeId = order.storeId?._id ?? order.storeId;
  if (user.role === "customer") assertOwnership(user, customerId);
  else assertStoreAccess(user, storeId);
}
