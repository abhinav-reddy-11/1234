import { useState } from "react";
import { api, formatDate } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Textarea } from "../../components/ui";

// Managers: create, submit and receive their store's POs.
// Admins: approve / reject / receive POs from every store.
export default function PurchaseOrders() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [status, setStatus] = useState(isAdmin ? "submitted" : "");
  const { data, loading, error, reload } = useApi(`/purchase-orders${status ? `?status=${status}` : ""}`);
  const [busyKey, setBusyKey] = useState(null);
  const [actionError, setActionError] = useState("");
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const act = async (key, fn) => {
    setBusyKey(key);
    setActionError("");
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        subtitle="Lifecycle: draft → submitted → approved (admin) → received. Stock increases only when goods are received."
        actions={<>
          <Button variant="secondary" onClick={reload}>Refresh</Button>
          {!isAdmin && <Button onClick={() => setCreating(true)}>New purchase order</Button>}
        </>}
      />
      <div className="mb-4 w-52">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {["draft", "submitted", "approved", "received", "rejected"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </Select>
      </div>
      <ErrorBox message={error || actionError} onRetry={error ? reload : undefined} />

      {loading ? <Loading /> : data?.purchaseOrders.length === 0 ? (
        <EmptyState title="No purchase orders" text={isAdmin ? "Nothing waiting with this status." : "Create one manually or from AI restock suggestions."} />
      ) : (
        <div className="space-y-3">
          {data?.purchaseOrders.map((po) => (
            <Card key={po._id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">PO-{po._id.slice(-6).toUpperCase()}</span>
                    <StatusBadge status={po.status} />
                    {po.aiSuggested && <Badge color="purple">AI suggested</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{po.storeId?.name} · by {po.createdBy?.name} · {formatDate(po.createdAt)}</p>
                  {po.approvedBy && <p className="text-xs text-slate-500">Approved by {po.approvedBy.name} on {formatDate(po.approvedAt)}</p>}
                  {po.rejectionReason && <p className="text-xs text-rose-600">Rejected: {po.rejectionReason}</p>}
                  {po.notes && <p className="text-xs text-slate-500">Note: {po.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {po.status === "draft" && !isAdmin && (
                    <Button size="sm" busy={busyKey === po._id + "s"} onClick={() => act(po._id + "s", () => api.patch(`/purchase-orders/${po._id}/submit`))}>Submit for approval</Button>
                  )}
                  {po.status === "submitted" && isAdmin && (
                    <>
                      <Button size="sm" variant="success" busy={busyKey === po._id + "a"} onClick={() => act(po._id + "a", () => api.patch(`/purchase-orders/${po._id}/approve`))}>Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => setRejecting(po)}>Reject</Button>
                    </>
                  )}
                  {po.status === "approved" && <Button size="sm" onClick={() => setReceiving(po)}>Record goods received</Button>}
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Product</th><th>Requested</th>{po.status === "received" && <th>Received</th>}</tr></thead>
                <tbody>
                  {po.items.map((it) => (
                    <tr key={it.productId?._id} className="border-t border-slate-100">
                      <td className="py-1.5">{it.productId?.name}</td>
                      <td>{it.quantityRequested}</td>
                      {po.status === "received" && <td className={it.quantityReceived < it.quantityRequested ? "text-amber-600" : "text-emerald-600"}>{it.quantityReceived}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}

      {creating && <CreatePO onClose={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />}
      {receiving && <ReceivePO po={receiving} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); reload(); }} />}
      {rejecting && <RejectPO po={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); reload(); }} />}
    </div>
  );
}

function CreatePO({ onClose, onCreated }) {
  const { data } = useApi("/products?sort=name");
  const [lines, setLines] = useState([{ productId: "", quantityRequested: 10 }]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (i, k, v) => setLines(lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const save = async (submit) => {
    setBusy(true);
    setError("");
    try {
      await api.post("/purchase-orders", { items: lines.filter((l) => l.productId).map((l) => ({ ...l, quantityRequested: Number(l.quantityRequested) })), notes, submit });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title="New purchase order" onClose={onClose}>
      <ErrorBox message={error} />
      <div className="space-y-3">
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <Select value={l.productId} onChange={(e) => update(i, "productId", e.target.value)} aria-label="Product">
                <option value="">Select product</option>
                {data?.products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="w-24"><Input type="number" min="1" value={l.quantityRequested} onChange={(e) => update(i, "quantityRequested", e.target.value)} /></div>
            {lines.length > 1 && <Button variant="ghost" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>×</Button>}
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setLines([...lines, { productId: "", quantityRequested: 10 }])}>+ Add product</Button>
        <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" busy={busy} onClick={() => save(false)}>Save draft</Button>
          <Button busy={busy} onClick={() => save(true)}>Create & submit</Button>
        </div>
      </div>
    </Modal>
  );
}

function ReceivePO({ po, onClose, onDone }) {
  const [qty, setQty] = useState(Object.fromEntries(po.items.map((i) => [i.productId._id, i.quantityRequested])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/purchase-orders/${po._id}/receive`, {
        items: Object.entries(qty).map(([productId, q]) => ({ productId, quantityReceived: Number(q) })),
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title="Record goods received" onClose={onClose}>
      <ErrorBox message={error} />
      <p className="mb-3 text-sm text-slate-600">Enter what actually arrived. Store inventory increases by these amounts.</p>
      <div className="space-y-2">
        {po.items.map((it) => (
          <div key={it.productId._id} className="flex items-center justify-between gap-3">
            <span className="text-sm">{it.productId.name} <span className="text-slate-400">(requested {it.quantityRequested})</span></span>
            <div className="w-24"><Input type="number" min="0" max={it.quantityRequested} value={qty[it.productId._id]} onChange={(e) => setQty({ ...qty, [it.productId._id]: e.target.value })} /></div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="success" busy={busy} onClick={save}>Confirm receipt</Button>
      </div>
    </Modal>
  );
}

function RejectPO({ po, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/purchase-orders/${po._id}/reject`, { reason });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title={`Reject PO-${po._id.slice(-6).toUpperCase()}`} onClose={onClose}>
      <ErrorBox message={error} />
      <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Budget exceeded this month" /></Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={save}>Reject</Button>
      </div>
    </Modal>
  );
}
