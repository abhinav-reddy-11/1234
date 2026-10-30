import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useShop } from "../../context/ShopContext";
import { ProductImage, StockBadge } from "../../components/ProductCard";
import { Button, Card, ErrorBox, Loading, SuccessBox, Table, Td } from "../../components/ui";

export default function ProductDetail() {
  const { id } = useParams();
  const { storeId, setStoreId, refreshCart } = useShop();
  const { data, loading, error, reload } = useApi(`/products/${id}`);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const p = data.product;
  const here = p.availability.find((a) => a.storeId === storeId);

  const add = async () => {
    setBusy(true);
    setErr("");
    try {
      const { items } = await api.get("/cart");
      const current = items.find((i) => i.product._id === p._id)?.quantity || 0;
      await api.post("/cart", { productId: p._id, quantity: current + qty });
      await refreshCart();
      setMsg(`Added ${qty} × ${p.name} to your cart.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/shop" className="text-sm text-indigo-600 hover:underline">← Back to shop</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card><ProductImage product={p} className="h-72" /></Card>
        <div>
          <p className="text-sm text-slate-500">{p.category?.name}</p>
          <h1 className="text-3xl font-bold text-slate-900">{p.name}</h1>
          <p className="mt-2 text-2xl font-bold text-indigo-700">{formatINR(p.price)}</p>
          <p className="mt-3 text-slate-600">{p.description}</p>
          <div className="mt-3"><StockBadge stock={here?.quantity ?? 0} /> <span className="text-sm text-slate-500">at your selected store</span></div>

          <SuccessBox message={msg} />
          <ErrorBox message={err} />
          <div className="mt-4 flex items-center gap-3">
            <input type="number" min="1" max="20" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value))))}
              className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Quantity" />
            <Button onClick={add} busy={busy} disabled={!here?.quantity}>Add to cart</Button>
          </div>

          {Object.keys(p.attributes || {}).length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 font-semibold">Specifications</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {Object.entries(p.attributes).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="capitalize text-slate-500">{k.replace(/([A-Z])/g, " $1")}</dt>
                    <dd className="text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Stock across stores</h2>
      <Table headers={["Store", "City", "Availability", ""]}>
        {p.availability.map((a) => (
          <tr key={a.storeId} className={a.storeId === storeId ? "bg-indigo-50/50" : ""}>
            <Td className="font-medium">{a.storeName}</Td>
            <Td>{a.city}</Td>
            <Td><StockBadge stock={a.quantity} /></Td>
            <Td>
              {a.storeId === storeId ? (
                <span className="text-xs font-medium text-indigo-700">Selected</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setStoreId(a.storeId)}>Shop here</Button>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
