# Deployment Guide — GitHub, Render, Vercel

Follow these in order. Do not mark deployment complete until the live frontend talks to the live backend.

## 1. MongoDB Atlas

1. Create a free cluster (M0 is enough) and a database user.
2. **Network Access → Add IP Address → `0.0.0.0/0`** (Render's IPs change, so allow all for the demo).
3. Copy the connection string and add the database name, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/retailpulse?retryWrites=true&w=majority`
4. Locally, put it in `server/.env`, then run:
   ```bash
   cd server
   npm run seed          # demo data + policy embeddings (first run downloads the model, ~25 MB)
   npm run create-index  # vector index "policy_vector_index"
   ```
5. In Atlas → **Atlas Search**, wait until `policy_vector_index` shows **READY** (about a minute).
   If `create-index` fails on your tier, create it in the UI with the JSON from the README.

## 2. GitHub

Create an **empty** repository named `retailpulse-ai` on GitHub (no README, no .gitignore — the project already has them). Then, from the project root:

```bash
cd retailpulse-ai

# Safety check: these must NOT appear in the output
git init
git status --ignored | grep -E "\.env$|node_modules" # should list them under "Ignored files"

git add .
git status                       # confirm no .env file is staged
git commit -m "Initial RetailPulse AI implementation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/retailpulse-ai.git
git push -u origin main
```

Later changes:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

**Team workflow:** each member works on a branch (`git checkout -b feature/manager-ui`), pushes it, and opens a pull request into `main`. Everyone follows `docs/API.md`.

If a secret is ever committed by mistake: rotate it immediately (new Atlas password, new JWT secret, new Groq key). Deleting the file later does not remove it from Git history.

## 3. Backend on Render

1. Render → **New → Web Service** → connect the `retailpulse-ai` repository.
2. Settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance type | Free is fine for the demo |

3. **Environment variables:**

   | Key | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas string |
   | `JWT_SECRET` | a long random string (e.g. output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `GROQ_API_KEY` | your Groq key |
   | `CLIENT_URL` | `http://localhost:5173` for now (updated in step 5) |
   | `RAG_SIMILARITY_THRESHOLD` | `0.70` |
   | `NODE_VERSION` | `20` (or newer) |

   Do **not** set `PORT` — Render provides it.
4. Deploy, then open `https://YOUR-SERVICE.onrender.com/api/health`. Expected:
   ```json
   { "success": true, "message": "RetailPulse AI backend is running", "database": "connected" }
   ```
   The log should also show `Embedding model ready: Xenova/all-MiniLM-L6-v2`.

## 4. Frontend on Vercel

1. Vercel → **Add New → Project** → import `retailpulse-ai`.
2. Settings:

   | Setting | Value |
   |---|---|
   | Framework Preset | Vite |
   | Root Directory | `client` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

3. Environment variable: `VITE_API_URL` = `https://YOUR-SERVICE.onrender.com` (no trailing slash, no `/api`).
4. Deploy. `client/vercel.json` already rewrites routes so refreshing `/manager/orders` doesn't 404.

## 5. Connect them

1. Copy the Vercel URL (e.g. `https://retailpulse-ai.vercel.app`).
2. On Render, set `CLIENT_URL` to: `http://localhost:5173,https://retailpulse-ai.vercel.app`
3. Render redeploys automatically after saving env vars.
4. If you change `VITE_API_URL` on Vercel, **redeploy** the frontend (Vite bakes it in at build time).

## 6. Post-deployment checklist

- [ ] `/api/health` returns `database: connected`
- [ ] Log in as each demo account (customer / manager / admin)
- [ ] Customer: search, compare, add to cart, checkout (delivery + takeaway)
- [ ] Inventory decreases after the order (manager inventory page)
- [ ] Manager: move an order to completed; customer's spend increases
- [ ] AI recommendation returns real products with "Ranked and explained by AI"
- [ ] Policy question returns an answer **with a source**
- [ ] Unrelated question (e.g. "Can I bring my pet to the cinema?") returns the fallback
- [ ] Bronze vs Gold get different answers about return windows
- [ ] Manager: AI restock → create & submit PO
- [ ] Admin: approve PO → record goods received → inventory increases
- [ ] Admin: upload a policy → approve → assistant uses it
- [ ] Audit log shows these actions

**Before the demo:** Render's free tier sleeps after inactivity. Open `/api/health` a minute before presenting so the server and embedding model are warm.
