import mongoose from "mongoose";
import { ROLES, TIERS } from "../utils/constants.js";

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, max: 20 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true, // creates a unique index -> duplicate email returns 409
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    // select: false -> never returned by queries unless explicitly asked for
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "customer" },

    // Membership (customers). Recalculated by the backend after completed orders.
    tier: { type: String, enum: TIERS, default: "bronze" },
    totalEligibleSpend: { type: Number, default: 0, min: 0 },

    // Managers must be assigned to exactly one store.
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: [
        function () {
          return this.role === "manager";
        },
        "Managers must be assigned to a store",
      ],
    },

    cart: { type: [cartItemSchema], default: [] },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Strip sensitive fields whenever a user is sent as JSON.
userSchema.set("toJSON", {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("User", userSchema);
