import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatINR } from "../../services/api";
import { useShop } from "../../context/ShopContext";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, EmptyState, ErrorBox, Field, Loading, PageHeader, Textarea, TierBadge } from "../../components/ui";

export default function Cart() {
  const { store, storeId, refreshCart } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fulfilment, setFulfilment] = useState("delivery");
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);

  // The quote (prices, discount, stock) is always calculated by the backend.
  const loadQuote = async () => {
    if (!storeId) return;
    setError("");
    try {
      const { items } = await api.get("/cart");
      if (items.length === 0) {
        setEmpty(true);
        setQuote(null);
      } else {
        setEmpty(false);
        setQuote((await api.post("/orders/quote", { storeId })).quote);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuote(); }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setQty = async (productId, quantity) => {
    try {
      await api.post("/cart", { productId, quantity });
      await Promise.all([loadQuote(), refreshCart()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const placeOrder = async () => {
    setPlacing(true);
    setError("");
    try {
      await api.post("/orders", { storeId, fulfilment, deliveryAddress: fulfilment === "delivery" ? address : undefined });
      await refreshCart();
      navigate("/orders", { state: { justOrdered: true } });
    } catch (err) {
      setError(err.message);
      loadQuote();
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <Loading />;
  if (empty) {
    return <EmptyState title="Your cart is empty" text="Browse the shop and add a few products." action={<Link to="/shop"><Button>Go to shop</Button></Link>} />;
  }

  return (
    <div>
      <PageHeader title="Cart & checkout" subtitle={store && `Ordering from ${store.name}. Change the store from the top bar.`} />
      <ErrorBox message={error} />
      {quote && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {quote.items.map((it) => (
              <Card key={it.productId} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <Link to={`/products/${it.productId}`} className="font-semibold hover:text-indigo-700">{it.name}</Link>
                  <p className="text-sm text-slate-500">{formatINR(it.price)} each</p>
                  {!it.inStock && (
                    <p className="mt-1 text-sm font-medium text-rose-600">
                      Only {it.available} available at this store — reduce the quantity or switch store.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-slate-300">
                    <button className="px-3 py-1 text-lg" onClick={() => setQty(it.productId, it.quantity - 1)}>−</button>
                    <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                    <button className="px-3 py-1 text-lg" onClick={() => setQty(it.productId, Math.min(20, it.quantity + 1))}>+</button>
                  </div>
                  <span className="w-24 text-right font-semibold">{formatINR(it.lineTotal)}</span>
                  <button className="text-sm text-rose-600 hover:underline" onClick={() => setQty(it.productId, 0)}>Remove</button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="h-fit space-y-4">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(quote.subtotal)}</span></div>
              <div className="flex justify-between text-emerald-600">
                <span className="flex items-center gap-2"><TierBadge tier={user.tier} /> discount ({quote.discountPercent}%)</span>
                <span>− {formatINR(quote.discount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span>{formatINR(quote.total)}</span></div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Fulfilment</p>
              <div className="grid grid-cols-2 gap-2">
                {["delivery", "takeaway"].map((f) => (
                  <button key={f} onClick={() => setFulfilment(f)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${fulfilment === f ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-600"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            {fulfilment === "delivery" ? (
              <Field label="Delivery address">
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`House, street, area in ${store?.city}`} />
              </Field>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Pick up at <b>{store?.name}</b>, {store?.city}.</p>
            )}

            <Button className="w-full" busy={placing} onClick={placeOrder}
              disabled={!quote.allInStock || (fulfilment === "delivery" && !address.trim())}>
              Pay {formatINR(quote.total)} (simulated)
            </Button>
            <p className="text-center text-xs text-slate-400">Payment is simulated. No real money is charged.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
