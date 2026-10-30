# Presentation Guide

Use simple, accurate language. Only claim what is implemented. Payments are simulated, delivery tracking is manual status updates, and AI accuracy is "grounded with fallbacks", not guaranteed.

## 30-second pitch
"RetailPulse AI connects customers, store managers and admins of a multi-store retailer in one platform. The backend owns every business rule (prices, discounts, stock and approvals), and AI is used only to recommend, explain and answer policy questions, always from real data, with citations and safe fallbacks."

## Feature explanations

### 1. Authentication and RBAC
- **Problem:** three kinds of users must see different data.
- **Logic:** bcrypt-hashed passwords; a JWT holds only user id + role; every request reloads the user from MongoDB, then three checks run: role (`authorize`), store (`assertStoreAccess`), ownership (`assertOwnership`).
- **Files:** `server/src/middleware/auth.js`, `controllers/authController.js`
- **Decision:** public registration always creates a customer; role or tier sent by the client is ignored.
- **Limitation:** no refresh tokens; sessions last 12 hours.

### 2. Store-wise inventory and orders
- **Problem:** the same product has different stock in each store, and two customers can buy the last unit at once.
- **Logic:** `inventories` has one record per `{storeId, productId}` (unique index). Checkout decrements each item with `findOneAndUpdate({ quantity: { $gte: qty } }, { $inc: -qty })`, so it only succeeds if enough stock exists. If a later item fails, earlier ones are put back.
- **Files:** `services/orders/orderService.js`, `controllers/orderController.js`
- **API:** `POST /orders/quote`, `POST /orders`, `PATCH /orders/:id/status`
- **Decision:** prices and names are copied into the order; status changes follow a fixed transition table and are applied atomically.
- **Limitation:** per-item atomic updates with compensation rather than full multi-document transactions.

### 3. Membership
- **Logic:** completing an order adds its total to `totalEligibleSpend` with `$inc`; `getTierForSpend()` upgrades at ₹5,000 (Silver) and ₹20,000 (Gold). Discounts (0/5/10%) are applied at checkout by the backend.
- **Files:** `utils/constants.js`, `services/orders/orderService.js`

### 4. Purchase orders
- **Logic:** draft → submitted → approved (admin only) → received. Stock increases only on receipt, by the quantity actually received. Each status change is atomic, so a double-click can't approve twice or add stock twice.
- **Files:** `controllers/purchaseOrderController.js`

### 5. AI recommendations
- **Logic:** backend filters active products ≤ budget, in category, with stock > 0 at the selected store → Groq ranks up to 3 with reasons → backend keeps only IDs from the candidate list; prices come from the DB.
- **Fallback:** keyword-matched list if Groq is down.
- **Files:** `services/ai/recommendations.js`

### 6. RAG policy assistant
- **Ingestion:** upload (Multer) → split by headings into ~700-char chunks with the heading prefixed → embed with Transformers.js (`all-MiniLM-L6-v2`, 384-d) → store as pending → admin approves.
- **Query:** tier read from DB → embed question → Atlas `$vectorSearch` filtered to approved + tier → score threshold → Groq answers only from tagged excerpts `[C1]…` → backend validates every citation is one it sent → document names come from our DB.
- **Hallucination controls:** approved-only filter, tier filter, similarity threshold, the LLM can answer "not found", citation validation, fallback messages, temperature 0.1.
- **Files:** `services/rag/*.js`, `services/ai/groq.js`
- **Limitation:** text-based uploads only; the threshold must be calibrated on real questions.

### 7. AI restock suggestions
- **Logic:** low-stock items + units sold in the last 14 days → rule baseline `max(2×reorderLevel, 14-day demand + reorderLevel) − stock` → Groq may adjust within ±50% and explains → out-of-range answers fall back to the rule → manager edits and creates a PO; an admin must approve it.
- **Files:** `services/ai/restock.js`, `client/src/pages/manager/Restock.jsx`

## Demo script (≈6 minutes)
1. **Gold customer** → Membership page (10% discount, progress bar).
2. Shop → switch store in the top bar → open a product → "Stock across stores".
3. AI Assistant → budget ₹3000, "wireless audio" → real, in-stock picks with reasons.
4. Add to cart → checkout shows the Gold discount → Delivery → Pay (simulated).
5. Policy assistant → "How many days do I have to return an item?" → answer + source card.
6. Ask "Can I bring my pet parrot to the cinema?" → fallback (no made-up answer).
7. **Manager (Hyderabad)** → dashboard low-stock alerts → Orders → mark packed → out for delivery → completed.
8. AI Restock → generate → edit a quantity → Create & submit.
9. **Admin** → Purchase Orders → Approve → Record goods received → Inventory shows the increase.
10. Admin → Policy Assistant → ask the same question "As Bronze" vs "As Gold" → different return windows (7 vs 30 days).
11. Audit Logs → every step recorded.

## Likely panel questions
- **What if the AI doesn't know?** The threshold check skips the LLM entirely, the LLM can return `found: false`, and invalid citations are rejected. All three lead to the fallback message.
- **Can the AI change prices or stock?** No. It only receives data and returns text plus IDs, which the backend validates.
- **Why MongoDB?** Flexible product attributes, and vector search lives in the same database as the business data.
- **Why local embeddings?** Free, no extra API key, and the same model is used for documents and questions.
- **How do you prevent overselling?** Conditional atomic decrement; we tested 5 simultaneous buyers for 1 unit and exactly 1 succeeded.
