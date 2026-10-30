import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as po from "../controllers/purchaseOrderController.js";
import * as admin from "../controllers/adminController.js";

const router = Router();
const adminOnly = [protect, authorize("admin")];
const staff = [protect, authorize("manager", "admin")];

// Purchase orders
router.post("/purchase-orders", ...staff, po.createPurchaseOrder);
router.get("/purchase-orders", ...staff, po.listPurchaseOrders);
router.get("/purchase-orders/:id", ...staff, po.getPurchaseOrder);
router.patch("/purchase-orders/:id/submit", ...staff, po.submitPurchaseOrder);
router.patch("/purchase-orders/:id/approve", ...adminOnly, po.approvePurchaseOrder);
router.patch("/purchase-orders/:id/reject", ...adminOnly, po.rejectPurchaseOrder);
router.post("/purchase-orders/:id/receive", ...staff, po.receivePurchaseOrder);

// Dashboards
router.get("/manager/dashboard", protect, authorize("manager"), admin.managerDashboard);
router.get("/admin/dashboard", ...adminOnly, admin.adminDashboard);

// Users
router.get("/admin/users", ...adminOnly, admin.listUsers);
router.post("/admin/users", ...adminOnly, admin.createStaffUser);
router.patch("/admin/users/:id", ...adminOnly, admin.updateUser);

// Audit
router.get("/audit", ...adminOnly, admin.listAuditLogs);

export default router;
