import { useState } from "react";
import { formatDate } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Badge, Button, EmptyState, ErrorBox, Loading, PageHeader, Select, Table, Td } from "../../components/ui";

const ENTITIES = ["Order", "PurchaseOrder", "PolicyDocument", "Inventory", "Product", "Store", "User", "Category"];

export default function AuditLogs() {
  const [entity, setEntity] = useState("");
  const { data, loading, error, reload } = useApi(`/audit?limit=200${entity ? `&entity=${entity}` : ""}`);

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Important actions across the organisation, newest first."
        actions={<Button variant="secondary" onClick={reload}>Refresh</Button>} />
      <div className="mb-4 w-56">
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Entity filter">
          <option value="">All entities</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>
      <ErrorBox message={error} onRetry={reload} />
      {loading ? <Loading /> : data?.logs.length === 0 ? <EmptyState title="No audit entries" /> : (
        <Table headers={["When", "Who", "Action", "Entity", "Details"]}>
          {data?.logs.map((l) => (
            <tr key={l._id}>
              <Td className="whitespace-nowrap text-xs">{formatDate(l.timestamp)}</Td>
              <Td><p className="text-sm">{l.actorId?.name}</p><p className="text-xs capitalize text-slate-500">{l.actorId?.role}</p></Td>
              <Td><Badge color="indigo">{l.action.replace(/_/g, " ").toLowerCase()}</Badge></Td>
              <Td className="text-xs">{l.entity} <span className="font-mono text-slate-400">{String(l.entityId || "").slice(-6)}</span></Td>
              <Td className="max-w-md break-all font-mono text-xs text-slate-500">{Object.keys(l.details || {}).length ? JSON.stringify(l.details) : "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
