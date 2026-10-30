import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { Badge, Button, EmptyState, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select, StatCard, Table, Td } from "../../components/ui";

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const { data: summary } = useApi(isAdmin ? "/inventory" : null);
  const [storeId, setStoreId] = useState(isAdmin ? "" : user.storeId?._id);
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (isAdmin && !storeId && summary?.stores.length) setStoreId(summary.stores[0].storeId);
  }, [isAdmin, storeId, summary]);

  const { data, loading, error, reload } = useApi(storeId ? `/inventory/${storeId}${lowOnly ? "?lowStock=true" : ""}` : null);
  const rows = (data?.inventory || []).filter((i) => i.product.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Low stock = quantity at or below the reorder level." />

      {isAdmin && summary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.stores.map((s) => (
            <button key={s.storeId} onClick={() => setStoreId(s.storeId)} className="text-left">
              <StatCard label={s.name} value={`${s.totalUnits} units`} hint={`${s.lowStock} low · ${s.outOfStock} out of stock`}
                tone={s.storeId === storeId ? "indigo" : s.lowStock ? "red" : "slate"} />
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isAdmin && (
          <div className="w-56">
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Store">
              {summary?.stores.map((s) => <option key={s.storeId} value={s.storeId}>{s.name}</option>)}
            </Select>
          </div>
        )}
        <div className="w-64"><Input placeholder="Search product..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="accent-indigo-600" /> Low stock only
        </label>
        {data && <Badge color={data.lowStockCount ? "red" : "green"}>{data.lowStockCount} low-stock items</Badge>}
      </div>

      <ErrorBox message={error} onRetry={reload} />
      {loading ? <Loading /> : rows.length === 0 ? <EmptyState title="No inventory records" /> : (
        <Table headers={["Product", "Category", "Quantity", "Reorder level", "Status", ""]}>
          {rows.map((i) => (
            <tr key={i._id} className={i.isLowStock ? "bg-rose-50/40" : ""}>
              <Td className="font-medium">{i.product.name}</Td>
              <Td>{i.product.category?.name}</Td>
              <Td className={i.quantity === 0 ? "font-bold text-rose-600" : i.isLowStock ? "font-semibold text-amber-600" : ""}>{i.quantity}</Td>
              <Td>{i.reorderLevel}</Td>
              <Td>{i.quantity === 0 ? <Badge color="red">Out of stock</Badge> : i.isLowStock ? <Badge color="yellow">Low stock</Badge> : <Badge color="green">OK</Badge>}</Td>
              <Td><Button size="sm" variant="secondary" onClick={() => setEditing(i)}>Edit</Button></Td>
            </tr>
          ))}
        </Table>
      )}
      <EditInventory item={editing} isAdmin={isAdmin} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
    </div>
  );
}

function EditInventory({ item, isAdmin, onClose, onSaved }) {
  const [reorderLevel, setReorderLevel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) { setReorderLevel(item.reorderLevel); setQuantity(item.quantity); setReason(""); setError(""); }
  }, [item]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body = { reorderLevel: Number(reorderLevel) };
      if (isAdmin && Number(quantity) !== item.quantity) Object.assign(body, { quantity: Number(quantity), reason });
      await api.patch(`/inventory/item/${item._id}`, body);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={Boolean(item)} title={`Edit: ${item?.product.name}`} onClose={onClose}>
      <ErrorBox message={error} />
      <div className="space-y-4">
        <Field label="Reorder level" hint="An alert appears when stock falls to this number or below.">
          <Input type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
        </Field>
        {isAdmin ? (
          <>
            <Field label="Stock correction (admin)" hint="Normally stock only changes through orders and received purchase orders.">
              <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            {Number(quantity) !== item?.quantity && (
              <Field label="Reason for correction"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged stock count" /></Field>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">To add stock, create a purchase order. Stock increases when the goods are received.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button busy={busy} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
