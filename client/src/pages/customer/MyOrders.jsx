import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, formatDate, formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import OrderTimeline from "../../components/OrderTimeline";
import { Badge, Button, Card, EmptyState, ErrorBox, Loading, PageHeader, StatusBadge, SuccessBox, TierBadge } from "../../components/ui";

export default function MyOrders() {
  const { data, loading, error, reload } = useApi("/orders/my");
  const location = useLocation();
  const [cancelling, setCancelling] = useState(null);
  const [actionError, setActionError] = useState("");

  const cancel = async (id) => {
    if (!window.confirm("Cancel this order? Stock is released and the payment is refunded.")) return;
    setCancelling(id);
    setActionError("");
    try {
      await api.patch(`/orders/${id}/status`, { status: "cancelled" });
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="My orders" actions={<Button variant="secondary" onClick={reload}>Refresh</Button>} />
      {location.state?.justOrdered && <SuccessBox message="Order placed! Payment was simulated successfully." />}
      <ErrorBox message={error || actionError} onRetry={error ? reload : undefined} />
      {data?.orders.length === 0 ? (
        <EmptyState title="No orders yet" action={<Link to="/shop"><Button>Start shopping</Button></Link>} />
      ) : (
        <div className="space-y-4">
          {data?.orders.map((o) => (
            <Card key={o._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Order #{o._id.slice(-6).toUpperCase()} · {formatDate(o.createdAt)}</p>
                  <p className="font-semibold">{o.storeId?.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={o.status} />
                    <Badge color="gray">{o.fulfilment}</Badge>
                    <TierBadge tier={o.tierAtPurchase} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{formatINR(o.total)}</p>
                  {o.discount > 0 && <p className="text-xs text-emerald-600">Saved {formatINR(o.discount)}</p>}
                  <p className="text-xs text-slate-400">Payment: {o.payment.method} · {o.payment.status}</p>
                </div>
              </div>
              <ul className="mt-3 text-sm text-slate-600">
                {o.items.map((it) => <li key={it.productId}>{it.quantity} × {it.name} — {formatINR(it.lineTotal)}</li>)}
              </ul>
              {o.deliveryAddress && <p className="mt-1 text-xs text-slate-500">Deliver to: {o.deliveryAddress}</p>}
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <OrderTimeline order={o} />
                {o.allowedNextStatuses.includes("cancelled") && (
                  <Button variant="secondary" size="sm" busy={cancelling === o._id} onClick={() => cancel(o._id)}>Cancel order</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
