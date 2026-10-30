import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useShop } from "../../context/ShopContext";
import PolicyChat from "../../components/PolicyChat";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, PageHeader, Select } from "../../components/ui";

function Recommendations() {
  const { store, storeId, refreshCart } = useShop();
  const { data: catData } = useApi("/categories");
  const [form, setForm] = useState({ budget: "", categoryId: "", preferences: "" });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.post("/ai/recommendations", { ...form, budget: Number(form.budget), storeId }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addToCart = async (productId) => {
    const { items } = await api.get("/cart");
    const current = items.find((i) => i.product._id === productId)?.quantity || 0;
    await api.post("/cart", { productId, quantity: current + 1 });
    await refreshCart();
    setAdded((a) => ({ ...a, [productId]: true }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="h-fit lg:col-span-2">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Budget (₹)"><Input type="number" min="1" required value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="e.g. 3000" /></Field>
          <Field label="Category (optional)">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Any category</option>
              {catData?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="What are you looking for?" hint="e.g. wireless audio for the gym, gift for a cook">
            <Input value={form.preferences} maxLength={200} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
          </Field>
          <Button type="submit" busy={busy} className="w-full">Get recommendations</Button>
          <p className="text-xs text-slate-500">Only real products that are in stock at {store?.name} and within budget are considered.</p>
        </form>
      </Card>

      <div className="space-y-3 lg:col-span-3">
        <ErrorBox message={error} />
        {result?.message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{result.message}</div>}
        {result && result.recommendations.length === 0 && <EmptyState title="No matches" text="Try increasing your budget or choosing another store." />}
        {result?.recommendations.map((r, i) => (
          <Card key={r.productId} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                  <Link to={`/products/${r.productId}`} className="font-semibold hover:text-indigo-700">{r.name}</Link>
                </div>
                <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
                <div className="mt-2 flex gap-2"><Badge>{r.category}</Badge><Badge color="green">{r.stock} in stock</Badge></div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatINR(r.price)}</p>
                <Button size="sm" className="mt-2" disabled={added[r.productId]} onClick={() => addToCart(r.productId)}>
                  {added[r.productId] ? "Added ✓" : "Add to cart"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {result && (
          <p className="text-xs text-slate-400">
            {result.aiUsed ? "Ranked and explained by AI (Groq). Prices and stock come from our database." : "Matched without AI."}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Assistant() {
  const [tab, setTab] = useState("recommend");
  const tabClass = (t) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`;
  return (
    <div>
      <PageHeader title="AI Assistant" subtitle="Personalised product picks and policy answers with sources." />
      <div className="mb-6 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        <button className={tabClass("recommend")} onClick={() => setTab("recommend")}>Product recommendations</button>
        <button className={tabClass("policy")} onClick={() => setTab("policy")}>Policy assistant</button>
      </div>
      {tab === "recommend" ? <Recommendations /> : <PolicyChat />}
    </div>
  );
}
