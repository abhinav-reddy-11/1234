import { Inventory, Order, Store } from "../../models/index.js";
import { AppError } from "../../utils/AppError.js";
import { groqJSON, AIUnavailableError } from "./groq.js";

const SALES_WINDOW_DAYS = 14;
const COVER_DAYS = 14; // aim to hold about two weeks of sales after restocking

const SYSTEM_PROMPT = `You help a retail store manager plan restocking.
For each low-stock product you get: current quantity, reorder level, units sold in the last ${SALES_WINDOW_DAYS} days,
and a baseline suggested quantity calculated by the system.
Suggest an order quantity for each product (you may adjust the baseline up to 50% either way) and give a one-sentence reason
that mentions the numbers. Only use the productIds provided.
Reply with JSON only: {"suggestions": [{"productId": "string", "quantity": number, "reason": "string"}]}`;

// Rule-based baseline: enough to cover expected sales for COVER_DAYS plus a reorder-level buffer.
function baselineQuantity({ quantity, reorderLevel, soldLastWindow }) {
  const avgDaily = soldLastWindow / SALES_WINDOW_DAYS;
  const target = Math.max(reorderLevel * 2, Math.ceil(avgDaily * COVER_DAYS) + reorderLevel);
  return Math.max(1, target - quantity);
}

export async function getRestockSuggestions(storeId) {
  const store = await Store.findById(storeId);
  if (!store) throw new AppError(404, "Store not found");

  // 1-2. Low-stock items for this store (quantity <= reorderLevel).
  const inventory = await Inventory.find({ storeId }).populate("productId", "name price").lean();
  const low = inventory.filter((i) => i.productId && i.quantity <= i.reorderLevel);
  if (low.length === 0) {
    return { aiUsed: false, store: store.name, suggestions: [], message: "No low-stock items right now." };
  }

  // 3. Recent sales from real orders (cancelled orders excluded).
  const since = new Date(Date.now() - SALES_WINDOW_DAYS * 24 * 3600 * 1000);
  const orders = await Order.find({ storeId, status: { $ne: "cancelled" }, createdAt: { $gte: since } }, "items").lean();
  const sold = {};
  for (const o of orders) for (const it of o.items) sold[it.productId.toString()] = (sold[it.productId.toString()] || 0) + it.quantity;

  const rows = low.map((i) => {
    const id = i.productId._id.toString();
    const row = { productId: id, name: i.productId.name, unitPrice: i.productId.price,
      quantity: i.quantity, reorderLevel: i.reorderLevel, soldLastWindow: sold[id] || 0 };
    return { ...row, baseline: baselineQuantity(row) };
  });

  const ruleReason = (r) =>
    `Stock ${r.quantity} is at/below reorder level ${r.reorderLevel}; ${r.soldLastWindow} sold in the last ${SALES_WINDOW_DAYS} days.`;

  // 4-5. Groq adjusts quantities and explains. Output is validated and clamped.
  let aiUsed = false;
  let aiById = new Map();
  try {
    const reply = await groqJSON(SYSTEM_PROMPT, `Store: ${store.name}\nLow-stock products:\n${JSON.stringify(
      rows.map(({ productId, name, quantity, reorderLevel, soldLastWindow, baseline }) =>
        ({ productId, name, quantity, reorderLevel, soldLastWindow, baseline }))
    )}`);
    aiById = new Map((reply?.suggestions || []).map((s) => [String(s.productId), s]));
    aiUsed = aiById.size > 0;
  } catch (err) {
    if (!(err instanceof AIUnavailableError)) throw err;
    console.warn("Restock fallback:", err.message);
  }

  const suggestions = rows.map((r) => {
    const ai = aiById.get(r.productId);
    const aiQty = Math.round(Number(ai?.quantity));
    const min = Math.max(1, Math.floor(r.baseline * 0.5));
    const max = Math.ceil(r.baseline * 1.5);
    const valid = Number.isFinite(aiQty) && aiQty >= min && aiQty <= max;
    return {
      productId: r.productId,
      name: r.name,
      currentQuantity: r.quantity,
      reorderLevel: r.reorderLevel,
      soldLastWindow: r.soldLastWindow,
      suggestedQuantity: valid ? aiQty : r.baseline,
      estimatedCost: (valid ? aiQty : r.baseline) * r.unitPrice,
      reason: valid && ai.reason ? String(ai.reason).slice(0, 300) : ruleReason(r),
      source: valid ? "ai" : "rule",
    };
  });

  return {
    aiUsed,
    store: store.name,
    salesWindowDays: SALES_WINDOW_DAYS,
    suggestions: suggestions.sort((a, b) => a.currentQuantity - b.currentQuantity),
    ...(aiUsed ? {} : { message: "AI is unavailable, so suggestions use the sales-based rule." }),
  };
}
