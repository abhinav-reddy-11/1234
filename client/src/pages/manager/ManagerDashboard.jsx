import { Link } from "react-router-dom";
import { formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Button, Card, ErrorBox, Loading, PageHeader, StatCard, StatusBadge, Table, Td } from "../../components/ui";

export default function ManagerDashboard() {
  const { data, loading, error, reload } = useApi("/manager/dashboard");
  const { data: low } = useApi(data ? `/inventory/${data.dashboard.store._id}?lowStock=true` : null);
  const { data: pending } = useApi("/orders?status=pending");

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const d = data.dashboard;

  return (
    <div>
      <PageHeader title={`${d.store.name}`} subtitle={`${d.store.address}, ${d.store.city}`}
        actions={<Button variant="secondary" onClick={reload}>Refresh</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders today" value={d.ordersToday} hint={`${formatINR(d.revenueToday)} revenue`} />
        <StatCard label="Pending orders" value={d.pendingOrders} hint={`${d.pendingDelivery} delivery · ${d.pendingTakeaway} takeaway`} tone="indigo" />
        <StatCard label="Low-stock items" value={d.lowStockItems} hint={`${d.outOfStockItems} out of stock`} tone={d.lowStockItems ? "red" : "green"} />
        <StatCard label="Open purchase orders" value={d.openPurchaseOrders.draft + d.openPurchaseOrders.submitted + d.openPurchaseOrders.approved}
          hint={`${d.openPurchaseOrders.submitted} awaiting approval · ${d.openPurchaseOrders.approved} to receive`} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Low-stock alerts</h2>
            <Link to="/manager/restock"><Button size="sm">Get AI restock suggestions</Button></Link>
          </div>
          {low?.inventory.length === 0 ? (
            <p className="text-sm text-slate-500">All products are above their reorder level.</p>
          ) : (
            <Table headers={["Product", "Stock", "Reorder at"]}>
              {low?.inventory.map((i) => (
                <tr key={i._id}>
                  <Td>{i.product.name}</Td>
                  <Td className={i.quantity === 0 ? "font-bold text-rose-600" : "font-semibold text-amber-600"}>{i.quantity}</Td>
                  <Td>{i.reorderLevel}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Orders needing action</h2>
            <Link to="/manager/orders" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          {pending?.orders.length === 0 ? (
            <p className="text-sm text-slate-500">No pending orders.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending?.orders.slice(0, 6).map((o) => (
                <li key={o._id} className="flex items-center justify-between py-2 text-sm">
                  <span>#{o._id.slice(-6).toUpperCase()} · {o.customerId?.name} · <span className="capitalize">{o.fulfilment}</span></span>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
