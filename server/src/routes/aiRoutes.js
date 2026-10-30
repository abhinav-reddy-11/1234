import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as ai from "../controllers/aiController.js";

const router = Router();
const adminOnly = [protect, authorize("admin")];

// AI features
router.post("/ai/recommendations", protect, authorize("customer"), ai.recommendations);
router.post("/ai/chat", protect, authorize("customer", "admin"), ai.chat);
router.post("/ai/restock-suggestions", protect, authorize("manager", "admin"), ai.restockSuggestions);

// Policy documents for RAG
router.get("/admin/policies", ...adminOnly, ai.listPolicies);
router.post("/admin/policies", ...adminOnly, ai.uploadPolicyFile, ai.uploadPolicy);
router.patch("/admin/policies/:id/approve", ...adminOnly, ai.approvePolicy);
router.patch("/admin/policies/:id/reject", ...adminOnly, ai.rejectPolicy);
router.patch("/admin/policies/:id/tiers", ...adminOnly, ai.updatePolicyTiers);

export default router;
