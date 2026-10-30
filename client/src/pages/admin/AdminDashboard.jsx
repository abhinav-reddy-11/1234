import { Link } from "react-router-dom";
import { formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Button, Card, ErrorBox, Loading, PageHeader, StatCard, Table, Td, TierBadge } from "../../components/ui";

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi("/admin/dashboard");
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const d = data.dashboard;

  return (
    <div>
      <PageHeader title="Organisation dashboard" subtitle="All stores at a glance" actions={<Button variant="secondary" onClick={reload}>Refresh</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders today" value={d.ordersToday} hint={`${formatINR(d.revenueToday)} revenue today`} />
        <StatCard label="Open orders" value={d.pendingOrders} tone="indigo" />
        <StatCard label="Low-stock items" value={d.lowStockItems} hint="across all stores" tone={d.lowStockItems ? "red" : "green"} />
        <StatCard label="Completed revenue" value={formatINR(d.completedRevenue)} tone="green" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Link to="/admin/purchase-orders"><StatCard label="POs awaiting approval" value={d.purchaseOrdersAwaitingApproval} tone="amber" hint="Click to review" /></Link>
        <Link to="/admin/purchase-orders"><StatCard label="POs awaiting receipt" value={d.purchaseOrdersAwaitingReceipt} hint="Approved, not yet received" /></Link>
        <Link to="/admin/policies"><StatCard label="Policies pending approval" value={d.pendingPolicies} tone="amber" hint="Click to review" /></Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Stores today</h2>
          <Table headers={["Store", "City", "Orders today", "Revenue today", "Low stock"]}>
            {d.perStore.map((s) => (
              <tr key={s.storeId}>
                <Td className="font-medium">{s.name}</Td>
                <Td>{s.city}</Td>
                <Td>{s.ordersToday}</Td>
                <Td>{formatINR(s.revenueToday)}</Td>
                <Td className={s.lowStock ? "font-semibold text-rose-600" : "text-emerald-600"}>{s.lowStock}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card>
          <h2 className="mb-3 font-semibold">Customers by tier</h2>
          {["gold", "silver", "bronze"].map((t) => (
            <div key={t} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
              <TierBadge tier={t} />
              <span className="text-lg font-bold">{d.customersByTier[t]}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
