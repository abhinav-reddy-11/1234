import mongoose from "mongoose";
import { ORDER_STATUS, FULFILMENT_TYPES, TIERS } from "../utils/constants.js";

// Name and price are copied into the order, so later catalogue price changes
// never alter a past order.
const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUS, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, "Order must have at least one item"],
    },
    // All three amounts are calculated by the backend.
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    tierAtPurchase: { type: String, enum: TIERS, required: true },

    fulfilment: { type: String, enum: FULFILMENT_TYPES, required: true },
    deliveryAddress: {
      type: String,
      trim: true,
      required: [
        function () {
          return this.fulfilment === "delivery";
        },
        "Delivery address is required for delivery orders",
      ],
    },

    status: { type: String, enum: ORDER_STATUS, default: "placed" },
    statusHistory: { type: [statusEntrySchema], default: [] },

    // Payments are simulated; no real gateway is involved.
    payment: {
      method: { type: String, default: "simulated" },
      status: { type: String, enum: ["paid", "refunded"], default: "paid" },
    },
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, createdAt: -1 }); // "my orders"
orderSchema.index({ storeId: 1, status: 1, createdAt: -1 }); // manager dashboard

export default mongoose.model("Order", orderSchema);
