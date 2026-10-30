# RetailPulse AI 🛒
### AI-Powered Multi-Store Retail Shopping and Operations Platform

## 1. Problem Statement

Retail businesses often manage customer shopping, inventory, restocking, membership benefits, and policies through disconnected systems.

This creates challenges such as:
- Difficulty monitoring inventory across multiple stores.
- Inefficient order and restocking management.
- Lack of personalised shopping experiences.
- Difficulty accessing membership-specific policies.
- Risk of incorrect or unsupported AI-generated information.

**RetailPulse AI** addresses these challenges through a unified platform that integrates multi-store shopping, inventory management, membership benefits, purchase-order workflows, and AI-powered assistance.

## 2. Key Features

### Customer
- Registration and JWT-based authentication.
- Searchable product catalogue with filters and sorting.
- Store selection with store-wise stock availability.
- Bronze, Silver, and Gold membership tiers.
- Cart, wishlist, and simulated checkout.
- Delivery and takeaway options.
- Order history and status tracking.
- AI-powered product recommendations.
- RAG-based policy assistant with citations.

### Store Manager
- Store-specific dashboard.
- View and manage assigned-store orders.
- Inventory monitoring and low-stock alerts.
- AI-powered restock suggestions.
- Purchase-order creation and tracking.

### Administrator
- Manage stores, users, products, and categories.
- Organisation-wide order and inventory monitoring.
- Approve or reject purchase orders.
- Upload and approve policy documents.
- Manage policy versions and membership applicability.
- Monitor audit logs.

### AI Capabilities
- **Product Recommendations:** Suggests products based on budget, preferences, category, and store availability.
- **Policy Assistant (RAG):** Retrieves information from approved policy documents and generates answers with citations.
- **Restock Suggestions:** Analyses inventory and recent sales to suggest replenishment quantities.
- **Fallback Handling:** Prevents unsupported answers when relevant policy information is unavailable.

## 3. System Architecture

```text
       Customer / Manager / Admin
                   |
             React Frontend
                   |
              REST APIs
                   |
             Express Backend
                   |
          Authentication & RBAC
                   |
        +----------+-----------+
        |                      |
    Core Services          AI Services
        |                      |
   +----+------+         +-----+------+
   |    |      |         |     |      |
Products Orders Inventory RAG Recommendations
Membership   Purchase    |      |
             Orders      |    Groq API
                         |
                  Transformers.js
                         |
                 Embedding Generation
                         |
                MongoDB Atlas Vector
                      Search
                         |
                    MongoDB Atlas
```

**Architecture Principles:**
- Backend controls pricing, membership calculations, inventory, orders, and purchase orders.
- AI provides recommendations and explanations rather than directly modifying business-critical data.
- Managers can access only their assigned stores.
- Only approved and membership-applicable policies are retrieved.
- Core retail operations remain available if the AI service fails.

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Vite |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Vector Search | MongoDB Atlas Vector Search |
| Embeddings | Transformers.js |
| Embedding Model | all-MiniLM-L6-v2 (384 dimensions) |
| LLM | Groq API |
| Authentication | JWT |
| Password Security | bcrypt |
| File Uploads | Multer |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |

## 5. Database Schema

MongoDB Atlas stores application data in the following collections:

| Collection | Important Fields | Purpose |
|---|---|---|
| `users` | name, email, passwordHash, role, tier, totalEligibleSpend, storeId | Stores customer, manager, and admin information |
| `stores` | name, address, city, isActive | Stores retail store information |
| `products` | name, category, price, attributes, tags | Maintains the shared product catalogue |
| `inventory` | storeId, productId, quantity, reorderLevel | Maintains store-wise stock |
| `orders` | customerId, storeId, items, subtotal, discount, total, fulfilment, status | Stores customer orders |
| `purchaseOrders` | storeId, createdBy, items, status, approvedBy, approvedAt | Manages replenishment requests |
| `policyDocuments` | title, version, appliesToTiers, status, uploadedBy, approvedBy | Stores policy document metadata |
| `policyChunks` | documentId, text, embedding, metadata | Stores policy chunks and embeddings |
| `auditLogs` | actorId, action, entity, entityId, timestamp | Records important system activities |

### Important Relationships

- Users are associated with stores through `storeId` for manager assignments.
- Orders reference customers and stores.
- Inventory references stores and products.
- Purchase orders reference stores, users, and products.
- Policy chunks reference their original policy documents.
- Audit logs reference the users who performed actions.

**Database Design Note:** Products and inventory are maintained separately because the same product can have different stock quantities across multiple stores.

A unique compound index on `{ storeId, productId }` prevents duplicate inventory records for the same product in a store.

## 6. Error Debugging and Troubleshooting

| Issue | Possible Cause | Troubleshooting |
|---|---|---|
| MongoDB connection failure | Incorrect connection string or network access restrictions | Verify `MONGODB_URI`, Atlas network access, and database credentials |
| JWT authentication failure | Missing, expired, or invalid token | Check the Authorization header and token verification |
| 403 Forbidden | Insufficient permissions or incorrect store assignment | Verify user role, assigned store, and ownership checks |
| Product stock mismatch | Inventory not updated correctly after an order | Check inventory validation and database update operations |
| Vector search failure | Incorrect vector index configuration or embedding dimensions | Verify Atlas Vector Search index and 384-dimensional embeddings |
| No relevant RAG results | Missing, unapproved, or irrelevant policy chunks | Verify document ingestion, approval status, tier filters, and retrieval settings |
| Incorrect AI policy answer | Insufficient context or unsupported generation | Check retrieved evidence, grounded prompts, and citation validation |
| Groq API failure | Invalid API key, rate limit, or service outage | Verify `GROQ_API_KEY`, API availability, and error handling |
| File upload failure | Invalid file type, size, or upload configuration | Check Multer configuration and file validation |
| Frontend API connection failure | Incorrect backend URL or CORS configuration | Verify frontend API base URL and backend CORS settings |

## 7. Limitations

- Uses synthetic demonstration data for 3–4 retail stores.
- Payments are simulated; no live payment gateway is integrated.
- Delivery tracking uses mocked order-status updates.
- Scanned PDF OCR is outside the initial scope.
- AI recommendations depend on available catalogue data.
- Restock suggestions depend on inventory and sales information.
- RAG accuracy depends on policy document quality and retrieval relevance.
- Fallback handling reduces unsupported responses but cannot guarantee that all generated answers are correct.
- The application is a hackathon prototype rather than a production-certified retail platform.
