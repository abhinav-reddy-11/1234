import { Router } from "express";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";
import * as catalog from "../controllers/catalogController.js";
import * as inventory from "../controllers/inventoryController.js";
import * as orders from "../controllers/orderController.js";
import * as customer from "../controllers/customerController.js";

const router = Router();
const admin = [protect, authorize("admin")];
const customerOnly = [protect, authorize("customer")];
const staff = [protect, authorize("manager", "admin")];

// Stores
router.get("/stores", optionalAuth, catalog.listStores);
router.post("/stores", ...admin, catalog.createStore);
router.patch("/stores/:id", ...admin, catalog.updateStore);

// Categories
router.get("/categories", catalog.listCategories);
router.post("/categories", ...admin, catalog.createCategory);
router.patch("/categories/:id", ...admin, catalog.updateCategory);

// Products (compare must come before :id)
router.get("/products", catalog.listProducts);
router.get("/products/compare", catalog.compareProducts);
router.get("/products/:id", catalog.getProduct);
router.post("/products", ...admin, catalog.createProduct);
router.patch("/products/:id", ...admin, catalog.updateProduct);

// Inventory
router.get("/inventory", ...admin, inventory.getInventorySummary);
router.get("/inventory/:storeId", protect, inventory.getStoreInventory);
router.patch("/inventory/item/:id", ...staff, inventory.updateInventoryItem);

// Cart, wishlist, membership (customers)
router.get("/cart", ...customerOnly, customer.getCart);
router.post("/cart", ...customerOnly, customer.setCartItem);
router.delete("/cart", ...customerOnly, customer.clearCart);
router.get("/wishlist", ...customerOnly, customer.getWishlist);
router.post("/wishlist/:productId", ...customerOnly, customer.toggleWishlist);
router.get("/membership/me", ...customerOnly, customer.getMembership);

// Orders
router.post("/orders/quote", ...customerOnly, orders.quoteOrder);
router.post("/orders", ...customerOnly, orders.createOrder);
router.get("/orders/my", ...customerOnly, orders.getMyOrders);
router.get("/orders", ...staff, orders.listOrders);
router.get("/orders/:id", protect, orders.getOrder);
router.patch("/orders/:id/status", protect, orders.updateOrderStatus);

export default router;
