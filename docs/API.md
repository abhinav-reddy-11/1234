# API Contract

Base URL: `http://localhost:5000/api` (production: `https://YOUR-SERVICE.onrender.com/api`)
Protected routes need `Authorization: Bearer <token>`.
Errors always look like `{ "success": false, "message": "...", "details"?: [...] }`.

| Code | Meaning |
|---|---|
| 400 | Invalid input / transition not allowed |
| 401 | Not logged in, invalid or expired token |
| 403 | Wrong role, other store, or not your data |
| 404 | Not found |
| 409 | Conflict (duplicate email, not enough stock, changed by someone else) |
| 502 | Embedding failed during policy upload |

## Auth
| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/auth/register` | public | `{ name, email, password }` → creates a **customer** |
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | any | — |

## Catalogue
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/stores` | public | admins also see inactive stores |
| POST / PATCH | `/stores`, `/stores/:id` | admin | `{ name, address, city, isActive }` |
| GET | `/categories` | public | |
| POST / PATCH | `/categories`, `/categories/:id` | admin | `{ name, description }` |
| GET | `/products` | public | query: `search, category, minPrice, maxPrice, sort (name, price_asc, price_desc, newest), storeId` (adds `stock`) |
| GET | `/products/compare?ids=a,b` | public | 2–4 ids |
| GET | `/products/:id` | public | includes `availability` per store |
| POST / PATCH | `/products`, `/products/:id` | admin | `{ name, category, price, description, tags[], attributes{} , isActive }` |

## Inventory
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/inventory` | admin | summary per store |
| GET | `/inventory/:storeId?lowStock=true` | any logged in (manager: own store) | |
| PATCH | `/inventory/item/:id` | manager (own store), admin | `{ reorderLevel }`; admin may also send `{ quantity, reason }` |

## Customer
| Method | Path | Body |
|---|---|---|
| GET | `/cart` | — |
| POST | `/cart` | `{ productId, quantity }` (sets quantity, 0 removes) |
| DELETE | `/cart` | — |
| GET | `/wishlist` | — |
| POST | `/wishlist/:productId` | toggles |
| GET | `/membership/me` | — |

## Orders
| Method | Path | Access | Body / query |
|---|---|---|---|
| POST | `/orders/quote` | customer | `{ storeId, items? }` (defaults to cart) → prices from DB |
| POST | `/orders` | customer | `{ storeId, fulfilment: "delivery"\|"takeaway", deliveryAddress?, items? }` |
| GET | `/orders/my` | customer | |
| GET | `/orders` | manager (own store), admin | `status (or "pending"), fulfilment, today=true, storeId (admin)` |
| GET | `/orders/:id` | owner / store manager / admin | |
| PATCH | `/orders/:id/status` | manager, admin; customer may only `cancelled` | `{ status }` |

Each order includes `allowedNextStatuses`. Transitions:
- delivery: `placed → packed → out_for_delivery → completed`
- takeaway: `placed → packed → ready_for_pickup → completed`
- `placed` or `packed` → `cancelled` (stock returned, payment refunded)
- `completed` adds the total to the customer's eligible spend and may upgrade the tier.

## Purchase orders
| Method | Path | Access | Body |
|---|---|---|---|
| POST | `/purchase-orders` | manager (own store), admin (`storeId`) | `{ items:[{productId, quantityRequested}], notes?, aiSuggested?, submit? }` |
| GET | `/purchase-orders?status=` | manager (own), admin | |
| GET | `/purchase-orders/:id` | manager (own), admin | |
| PATCH | `/purchase-orders/:id/submit` | manager, admin | draft → submitted |
| PATCH | `/purchase-orders/:id/approve` | admin | submitted → approved |
| PATCH | `/purchase-orders/:id/reject` | admin | `{ reason }` |
| POST | `/purchase-orders/:id/receive` | manager (own), admin | `{ items?:[{productId, quantityReceived}] }` → inventory increases |

## Dashboards, users, audit
| Method | Path | Access |
|---|---|---|
| GET | `/manager/dashboard` | manager |
| GET | `/admin/dashboard` | admin |
| GET / POST | `/admin/users` | admin (`POST { name, email, password, role: manager\|admin, storeId }`) |
| PATCH | `/admin/users/:id` | admin (`{ isActive, storeId }`) |
| GET | `/audit?entity=&action=&limit=` | admin |

## AI
| Method | Path | Access | Body → response |
|---|---|---|---|
| POST | `/ai/recommendations` | customer | `{ budget, storeId, categoryId?, preferences? }` → `{ aiUsed, recommendations:[{productId, name, price, stock, reason}], message? }` |
| POST | `/ai/chat` | customer (admin with `tier` preview) | `{ question }` → `{ answer, fallback, reason?, confidence, citations:[{chunkId, document, version, section, page, score, snippet}], tier }` |
| POST | `/ai/restock-suggestions` | manager (admin with `storeId`) | → `{ aiUsed, suggestions:[{productId, name, currentQuantity, reorderLevel, soldLastWindow, suggestedQuantity, estimatedCost, reason, source}] }` |

## Policies (admin)
| Method | Path | Body |
|---|---|---|
| GET | `/admin/policies?status=` | — |
| POST | `/admin/policies` | multipart: `file` (.md/.txt/.json ≤ 4 MB), `title`, `appliesToTiers` ("bronze,silver,gold") |
| PATCH | `/admin/policies/:id/approve` | archives older approved versions |
| PATCH | `/admin/policies/:id/reject` | — |
| PATCH | `/admin/policies/:id/tiers` | `{ appliesToTiers: ["gold"] }` |

## Health
`GET /api/health` → `{ success: true, message: "RetailPulse AI backend is running", database: "connected" }`
