import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatINR } from "../../services/api";
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Table, Td } from "../../components/ui";

export default function Restock() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState({}); // productId -> quantity
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/ai/restock-suggestions");
      setResult(r);
      setSelected(Object.fromEntries(r.suggestions.map((s) => [s.productId, s.suggestedQuantity])));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // The manager reviews/edits quantities, then creates a purchase order.
  // Nothing is approved automatically: an admin must approve it.
  const createPO = async (submit) => {
    const items = Object.entries(selected).filter(([, q]) => q > 0).map(([productId, q]) => ({ productId, quantityRequested: Number(q) }));
    if (!items.length) return setError("Select at least one product");
    setCreating(true);
    setError("");
    try {
      await api.post("/purchase-orders", { items, aiSuggested: true, submit, notes: "Created from AI restock suggestions" });
      navigate("/manager/purchase-orders");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const total = result?.suggestions.reduce((sum, s) => sum + (selected[s.productId] ? Number(selected[s.productId]) : 0) * (s.estimatedCost / s.suggestedQuantity), 0) ?? 0;

  return (
    <div>
      <PageHeader title="AI restock suggestions" subtitle="Uses your store's low-stock items and the last 14 days of sales. You review before anything is ordered."
        actions={<Button busy={busy} onClick={generate}>{result ? "Regenerate" : "Generate suggestions"}</Button>} />
      <ErrorBox message={error} />

      {!result && !busy && <EmptyState title="No suggestions yet" text="Click “Generate suggestions” to analyse low stock and recent sales." />}
      {result?.message && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{result.message}</div>}

      {result?.suggestions.length > 0 && (
        <>
          <Table headers={["", "Product", "Stock / reorder", `Sold (${result.salesWindowDays}d)`, "Order qty", "Why", "Source"]}>
            {result.suggestions.map((s) => (
              <tr key={s.productId}>
                <Td>
                  <input type="checkbox" className="accent-indigo-600" checked={selected[s.productId] > 0}
                    onChange={(e) => setSelected({ ...selected, [s.productId]: e.target.checked ? s.suggestedQuantity : 0 })} />
                </Td>
                <Td className="font-medium">{s.name}</Td>
                <Td><span className={s.currentQuantity === 0 ? "font-bold text-rose-600" : "text-amber-600"}>{s.currentQuantity}</span> / {s.reorderLevel}</Td>
                <Td>{s.soldLastWindow}</Td>
                <Td>
                  <input type="number" min="0" max="1000" value={selected[s.productId] ?? 0}
                    onChange={(e) => setSelected({ ...selected, [s.productId]: Math.max(0, Number(e.target.value)) })}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                </Td>
                <Td className="max-w-xs text-xs text-slate-600">{s.reason}</Td>
                <Td><Badge color={s.source === "ai" ? "purple" : "gray"}>{s.source === "ai" ? "AI" : "Rule"}</Badge></Td>
              </tr>
            ))}
          </Table>
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-slate-600">Estimated cost at catalogue price: <b>{formatINR(total)}</b></p>
            <div className="flex gap-2">
              <Button variant="secondary" busy={creating} onClick={() => createPO(false)}>Save as draft PO</Button>
              <Button busy={creating} onClick={() => createPO(true)}>Create & submit for approval</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
