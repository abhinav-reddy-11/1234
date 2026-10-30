# RetailPulse AI
### AI-Powered Multi-Store Retail Shopping and Operations Platform

## 1. Problem Statement

Retail businesses often manage customer shopping, inventory, restocking, membership benefits and policies through disconnected systems. This creates challenges such as:

- Difficulty monitoring inventory across multiple stores.
- Inefficient order and restocking management.
- Lack of personalised shopping experiences.
- Difficulty accessing membership-specific policies.
- Risk of incorrect or unsupported AI-generated information.

**RetailPulse AI** addresses these challenges with one platform that connects customers, store managers and administrators, combining multi-store shopping, inventory management, membership benefits, purchase-order workflows and AI assistance.

## 2. Key Features

### Customer
- Registration and JWT-based login.
- Product catalogue with search, category and price filters, sorting and side-by-side comparison.
- Store selection with store-wise stock availability.
- Bronze, Silver and Gold membership with automatic upgrades and tier discounts.
- Cart, wishlist and simulated checkout with **delivery** or **takeaway**.
- Order history with a status timeline; cancellation before packing.
- AI product recommendations and a RAG policy assistant with citations.

### Store Manager
- Store-specific dashboard (today's orders, pending delivery/takeaway, low-stock count).
- Order status updates following fixed transitions.
- Store inventory with low-stock alerts (`quantity <= reorderLevel`).
- AI restock suggestions → reviewed → purchase order.
- Purchase-order creation, submission and tracking.

### Administrator
- Organisation-wide dashboard, order monitoring and inventory monitoring.
- Store, user/manager, product and category management.
- Purchase-order approval/rejection and goods receipt.
- Policy upload, approval, version management and membership applicability.
- Audit logs of important actions.

### Membership rules

| Eligible spend (completed orders) | Tier | Discount |
|---|---|---|
| Below ₹5,000 | Bronze (default) | 0% |
| ₹5,000 – ₹19,999 | Silver | 5% |
| ₹20,000 and above | Gold | 10% |

All prices, discounts, totals and tier changes are calculated by the backend.

### AI Capabilities
- **Product recommendations:** the backend filters the real catalogue by budget, category and store stock; Groq only ranks and explains those products. Invented product IDs are discarded.
- **Policy assistant (RAG):** answers only from approved policies for the customer's tier, with validated citations (document, version, section, chunk ID).
- **Restock suggestions:** low-stock items + last 14 days of sales → rule-based baseline → Groq adjusts within ±50% and explains. The manager reviews before creating a purchase order.
- **Fallback handling:** low relevance, missing policies, invalid citations, Groq errors or timeouts all return a safe message. Core shopping works without Groq.

## 3. System Architecture

```text
              CUSTOMER / MANAGER / ADMIN
                         |
                         v
          REACT FRONTEND (Vite + Tailwind)
                         |
                     REST APIs (JWT)
                         |
                         v
                NODE.JS + EXPRESS
                         |
              AUTHENTICATION + RBAC
         (role, store assignment, ownership)
                         |
          +--------------+---------------+
          |                              |
          v                              v
    CORE SERVICES                   AI SERVICES
    Products                        RAG Policy Assistant
    Orders                          Recommendations
    Inventory                       Restock Suggestions
    Membership                           |
    Purchase Orders                      v
          |                          GROQ API
          |                              ^
          |                              |
          |                       TRANSFORMERS.JS
          |                    (all-MiniLM-L6-v2, 384-d)
          |                              |
          |                      QUERY EMBEDDINGS
          |                              |
          |                     ATLAS VECTOR SEARCH
          |                              |
          +--------------+---------------+
                         |
                         v
                   MONGODB ATLAS
```

### RAG flow

```text
INGESTION (admin)                          QUERY (customer)
Upload .md/.txt/.json (Multer, ≤4 MB)      Question + tier from DB (never from request)
        |                                          |
Split by headings, ~700-char chunks        Embed question (same model)
        |                                          |
Embed each chunk (384-d)                   $vectorSearch: approved + tier filter, top 5
        |                                          |
Store chunks as "pending"                  Score >= threshold?  -- no --> fallback
        |                                          | yes
Admin approves -> chunks "approved",       Groq answers from tagged excerpts [C1..Cn]
older versions "archived"                          |
                                           Citations ⊆ retrieved?  -- no --> fallback
                                                   | yes
                                           Answer + sources (names from DB)
```

**Architecture principles**
- The backend controls pricing, membership, inventory, orders and purchase orders.
- AI suggests and explains; it never changes business data.
- Managers can only access their assigned store; customers only their own data.
- Only approved, tier-applicable policies are retrieved.
- Core retail operations keep working if the AI service fails.

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, React Router |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js (ES modules) |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Vector search | MongoDB Atlas Vector Search |
| Embeddings | Transformers.js (`Xenova/all-MiniLM-L6-v2`, 384 dimensions) |
| LLM | Groq API (`llama-3.3-70b-versatile`) |
| Authentication | JWT |
| Password hashing | bcrypt |
| File uploads | Multer |
| Deployment | Vercel (frontend), Render (backend) |

### Getting started (local)

**Prerequisites:** Node.js 20+, a MongoDB Atlas cluster, a Groq API key (optional — AI falls back without it).

```bash
# 1. Backend
cd server
npm install
cp .env.example .env          # fill in MONGODB_URI, JWT_SECRET, GROQ_API_KEY
npm run seed                  # demo stores, products, users, orders + policies (downloads the embedding model once)
npm run create-index          # creates the Atlas Vector Search index "policy_vector_index"
npm run dev                   # http://localhost:5000/api/health

# 2. Frontend (new terminal)
cd client
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:5000
npm run dev                   # http://localhost:5173
```

**Demo accounts** (password `Demo@123`): `gold@retailpulse.demo`, `silver@retailpulse.demo`, `bronze@retailpulse.demo`, `manager.hyderabad@retailpulse.demo` (also `.warangal`, `.bengaluru`, `.chennai`), `admin@retailpulse.demo`.

**Vector index** (if you prefer the Atlas UI: Atlas Search → Create Search Index → Vector Search → JSON editor, collection `policychunks`, name `policy_vector_index`):

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 384, "similarity": "cosine" },
    { "type": "filter", "path": "metadata.status" },
    { "type": "filter", "path": "metadata.appliesToTiers" }
  ]
}
```

**Backend environment variables**

| Variable | Purpose |
|---|---|
| `PORT` | Server port (Render sets this automatically) |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Long random string for signing tokens |
| `GROQ_API_KEY` | Groq key (AI features fall back without it) |
| `CLIENT_URL` | Allowed frontend origins, comma-separated |
| `RAG_SIMILARITY_THRESHOLD` | Minimum vector score to count as evidence (default 0.70, calibrate) |

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for GitHub, Render and Vercel, and [`docs/API.md`](docs/API.md) for the API contract.

## 5. Database Schema

| Collection | Important fields | Purpose |
|---|---|---|
| `users` | name, email (unique), passwordHash, role, tier, totalEligibleSpend, storeId, cart, wishlist, isActive | Customers, managers and admins |
| `stores` | name, address, city, isActive | Retail stores |
| `categories` | name (unique), description | Admin-managed categories |
| `products` | name, category → categories, price, attributes, tags, isActive | Shared catalogue |
| `inventories` | storeId, productId, quantity (≥ 0), reorderLevel | Store-wise stock |
| `orders` | customerId, storeId, items (name + price snapshot), subtotal, discount, total, tierAtPurchase, fulfilment, deliveryAddress, status, statusHistory, payment | Customer orders |
| `purchaseorders` | storeId, createdBy, items (quantityRequested, quantityReceived), status, aiSuggested, approvedBy, approvedAt, rejectionReason, receivedAt | Replenishment requests |
| `policydocuments` | title, version, appliesToTiers, status, fileName, chunkCount, uploadedBy, approvedBy | Policy metadata and versions |
| `policychunks` | documentId, text, embedding (384), metadata {status, appliesToTiers, version, source, section, page, chunkIndex} | RAG chunks |
| `auditlogs` | actorId, action, entity, entityId, details, timestamp | Important activities |

**Key indexes:** unique `{storeId, productId}` on inventory (one record per product per store), unique `{title, version}` on policy documents, `{customerId, createdAt}` and `{storeId, status, createdAt}` on orders.

**Design notes**
- Products and inventory are separate because the same product has different stock in each store.
- Orders copy product name and price, so later price changes never alter past orders.
- Stock is decremented with a conditional atomic update (`quantity >= requested`), so concurrent buyers cannot oversell.
- Status changes (orders and purchase orders) are atomic and only follow allowed transitions.
- Inventory increases only when purchase-order goods are recorded as received.

## 6. Error Debugging and Troubleshooting

| Issue | Possible cause | Troubleshooting |
|---|---|---|
| Server exits on start | `MONGODB_URI` or `JWT_SECRET` missing | Check `server/.env`; the log names the missing variable |
| MongoDB connection failure | Wrong connection string or Atlas network access | Verify `MONGODB_URI`, user password, and Atlas *Network Access* (allow `0.0.0.0/0` for Render) |
| 401 Unauthorized | Missing, expired (12 h) or invalid token | Log in again; check the `Authorization: Bearer <token>` header |
| 403 Forbidden | Wrong role, store assignment or ownership | Managers only access their store; customers only their own orders |
| 409 Not enough stock | Requested quantity exceeds store stock | Reduce quantity or choose another store |
| 400 Cannot change status | Transition not allowed | Orders: placed → packed → out for delivery / ready for pickup → completed |
| Policy assistant always falls back | Vector index missing, not READY, or wrong dimensions | Run `npm run create-index`; check the index is READY with 384 dimensions |
| "No relevant policy" for valid questions | Threshold too high, document not approved, or wrong tier | Approve the document; check tiers; lower `RAG_SIMILARITY_THRESHOLD` slightly |
| "AI assistant temporarily unavailable" | Missing/invalid `GROQ_API_KEY`, rate limit or timeout | Verify the key; core features keep working meanwhile |
| Embedding model fails to load | No internet on first run (model downloads once) | Allow outbound internet; restart the server |
| File upload rejected | Not `.md/.txt/.json` or over 4 MB | Use a text-based file; PDFs/OCR are out of scope |
| CORS error in browser | Frontend URL not in `CLIENT_URL` | Add the exact Vercel URL (no trailing slash) to `CLIENT_URL` on Render |
| 404 on page refresh (Vercel) | SPA routing | `client/vercel.json` rewrites all routes to `index.html` |
| First request on Render is slow | Free instance sleeping | Open `/api/health` a minute before the demo |

## 7. Limitations

- Uses synthetic demonstration data for 4 retail stores.
- Payments are simulated; no payment gateway is integrated.
- Delivery tracking uses manual status updates, not live courier tracking.
- Policy upload supports text-based files (.md, .txt, .json); PDF parsing and OCR are out of scope.
- Recommendations depend on catalogue tags/attributes; restock suggestions depend on recent order history.
- RAG accuracy depends on document quality and the calibrated similarity threshold. Fallbacks reduce unsupported answers but cannot guarantee every answer is correct.
- Stock reservation uses per-item atomic updates with compensation, not multi-document transactions.
- This is a hackathon prototype, not a production-certified retail platform (no rate limiting, monitoring or backups).
