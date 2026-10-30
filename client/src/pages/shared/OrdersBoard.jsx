import { useState } from "react";
import { api, formatDate, formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { Badge, Button, EmptyState, ErrorBox, Loading, PageHeader, Select, StatusBadge, Table, Td, TierBadge, statusLabel } from "../../components/ui";

// Managers: their store's orders. Admins: all stores, with a store filter.
export default function OrdersBoard() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [filters, setFilters] = useState({ status: "pending", fulfilment: "", today: false, storeId: "" });
  const { data: storeData } = useApi(isAdmin ? "/stores" : null);

  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.fulfilment) params.set("fulfilment", filters.fulfilment);
  if (filters.today) params.set("today", "true");
  if (filters.storeId) params.set("storeId", filters.storeId);
  const { data, loading, error, reload } = useApi(`/orders?${params}`);

  const [updating, setUpdating] = useState(null);
  const [actionError, setActionError] = useState("");

  const move = async (order, status) => {
    if (status === "cancelled" && !window.confirm("Cancel this order? Stock will be returned and the customer refunded.")) return;
    setUpdating(order._id + status);
    setActionError("");
    try {
      await api.patch(`/orders/${order._id}/status`, { status });
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div>
      <PageHeader title="Orders" subtitle={isAdmin ? "Organisation-wide order monitoring" : "Orders for your store"}
        actions={<Button variant="secondary" onClick={reload}>Refresh</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isAdmin && (
          <div className="w-52">
            <Select value={filters.storeId} onChange={set("storeId")} aria-label="Store">
              <option value="">All stores</option>
              {storeData?.stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </div>
        )}
        <div className="w-44">
          <Select value={filters.status} onChange={set("status")} aria-label="Status">
            <option value="pending">Pending (open)</option>
            <option value="">All statuses</option>
            {["placed", "packed", "out_for_delivery", "ready_for_pickup", "completed", "cancelled"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select value={filters.fulfilment} onChange={set("fulfilment")} aria-label="Fulfilment">
            <option value="">Delivery + takeaway</option>
            <option value="delivery">Delivery</option>
            <option value="takeaway">Takeaway</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={filters.today} onChange={set("today")} className="accent-indigo-600" /> Today only
        </label>
      </div>

      <ErrorBox message={error || actionError} onRetry={error ? reload : undefined} />
      {loading ? <Loading /> : data?.orders.length === 0 ? (
        <EmptyState title="No orders match these filters" />
      ) : (
        <Table headers={["Order", "Customer", ...(isAdmin ? ["Store"] : []), "Items", "Total", "Type", "Status", "Actions"]}>
          {data?.orders.map((o) => (
            <tr key={o._id}>
              <Td><p className="font-mono text-xs font-semibold">#{o._id.slice(-6).toUpperCase()}</p><p className="text-xs text-slate-500">{formatDate(o.createdAt)}</p></Td>
              <Td><p>{o.customerId?.name}</p>{o.customerId?.tier && <TierBadge tier={o.tierAtPurchase} />}</Td>
              {isAdmin && <Td>{o.storeId?.name}</Td>}
              <Td className="max-w-56 text-xs text-slate-600">{o.items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}</Td>
              <Td className="font-semibold">{formatINR(o.total)}</Td>
              <Td><Badge color={o.fulfilment === "delivery" ? "purple" : "indigo"}>{o.fulfilment}</Badge></Td>
              <Td><StatusBadge status={o.status} /></Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  {o.allowedNextStatuses.map((s) => (
                    <Button key={s} size="sm" variant={s === "cancelled" ? "secondary" : s === "completed" ? "success" : "primary"}
                      busy={updating === o._id + s} onClick={() => move(o, s)}>
                      {s === "cancelled" ? "Cancel" : `Mark ${statusLabel(s).toLowerCase()}`}
                    </Button>
                  ))}
                  {o.allowedNextStatuses.length === 0 && <span className="text-xs text-slate-400">—</span>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
