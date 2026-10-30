// Single source of truth for business rules. Models, services and seed data all import from here.

export const ROLES = ["customer", "manager", "admin"];
export const TIERS = ["bronze", "silver", "gold"];

// Membership upgrade thresholds in ₹ of eligible (completed-order) spend.
export const TIER_THRESHOLDS = { silver: 5000, gold: 20000 };

// Demo discount per tier, applied by the backend at checkout (never by the frontend).
export const TIER_DISCOUNT_PERCENT = { bronze: 0, silver: 5, gold: 10 };

export function getTierForSpend(spend) {
  if (spend >= TIER_THRESHOLDS.gold) return "gold";
  if (spend >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export const FULFILMENT_TYPES = ["delivery", "takeaway"];

export const ORDER_STATUS = [
  "placed",
  "packed",
  "out_for_delivery", // delivery orders only
  "ready_for_pickup", // takeaway orders only
  "completed",
  "cancelled",
];

// Allowed status moves. Anything not listed here is rejected by the backend.
export const ORDER_TRANSITIONS = {
  delivery: {
    placed: ["packed", "cancelled"],
    packed: ["out_for_delivery", "cancelled"],
    out_for_delivery: ["completed"],
  },
  takeaway: {
    placed: ["packed", "cancelled"],
    packed: ["ready_for_pickup", "cancelled"],
    ready_for_pickup: ["completed"],
  },
};

export const PO_STATUS = ["draft", "submitted", "approved", "rejected", "received"];

export const PO_TRANSITIONS = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["received"],
};

export const POLICY_STATUS = ["pending", "approved", "rejected", "archived"];

// Frozen by the architecture: Xenova/all-MiniLM-L6-v2 outputs 384-dimensional vectors.
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;
