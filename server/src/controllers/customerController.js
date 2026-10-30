import mongoose from "mongoose";
import { User, Product } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { TIER_THRESHOLDS, TIER_DISCOUNT_PERCENT } from "../utils/constants.js";

const CART_POPULATE = { path: "cart.productId", select: "name price imageUrl isActive" };

// ---------- Cart ----------

// GET /api/cart
export async function getCart(req, res) {
  const user = await User.findById(req.user._id).populate(CART_POPULATE);
  const items = user.cart
    .filter((c) => c.productId?.isActive)
    .map((c) => ({ product: c.productId, quantity: c.quantity, lineTotal: c.productId.price * c.quantity }));
  res.json({ success: true, items, subtotal: items.reduce((s, i) => s + i.lineTotal, 0) });
}

// POST /api/cart { productId, quantity }  — sets the quantity; 0 removes the item.
export async function setCartItem(req, res) {
  const { productId } = req.body;
  const quantity = Number(req.body.quantity);
  if (!mongoose.isValidObjectId(productId)) throw new AppError(400, "Invalid productId");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) throw new AppError(400, "Quantity must be 0–20");
  if (quantity > 0 && !(await Product.exists({ _id: productId, isActive: true }))) {
    throw new AppError(404, "Product not found");
  }

  const user = await User.findById(req.user._id);
  const existing = user.cart.find((c) => c.productId.toString() === productId);
  if (quantity === 0) user.cart = user.cart.filter((c) => c.productId.toString() !== productId);
  else if (existing) existing.quantity = quantity;
  else user.cart.push({ productId, quantity });
  await user.save();

  req.user = user;
  return getCart(req, res);
}

// DELETE /api/cart
export async function clearCart(req, res) {
  await User.updateOne({ _id: req.user._id }, { $set: { cart: [] } });
  res.json({ success: true, items: [], subtotal: 0 });
}

// ---------- Wishlist ----------

export async function getWishlist(req, res) {
  const user = await User.findById(req.user._id).populate({
    path: "wishlist", select: "name price imageUrl category isActive", populate: { path: "category", select: "name" },
  });
  res.json({ success: true, products: user.wishlist.filter((p) => p?.isActive) });
}

// POST /api/wishlist/:productId  — toggles the product in/out of the wishlist.
export async function toggleWishlist(req, res) {
  const { productId } = req.params;
  if (!(await Product.exists({ _id: productId }))) throw new AppError(404, "Product not found");
  const user = await User.findById(req.user._id);
  const inList = user.wishlist.some((id) => id.toString() === productId);
  await User.updateOne(
    { _id: user._id },
    inList ? { $pull: { wishlist: productId } } : { $addToSet: { wishlist: productId } }
  );
  res.json({ success: true, inWishlist: !inList });
}

// ---------- Membership ----------

// GET /api/membership/me
export async function getMembership(req, res) {
  const { tier, totalEligibleSpend } = req.user;
  const next = tier === "bronze" ? "silver" : tier === "silver" ? "gold" : null;
  res.json({
    success: true,
    membership: {
      tier,
      totalEligibleSpend,
      discountPercent: TIER_DISCOUNT_PERCENT[tier],
      nextTier: next,
      amountToNextTier: next ? Math.max(0, TIER_THRESHOLDS[next] - totalEligibleSpend) : 0,
      thresholds: { bronze: 0, ...TIER_THRESHOLDS },
      discounts: TIER_DISCOUNT_PERCENT,
    },
  });
}
