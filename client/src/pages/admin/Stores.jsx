import { useState } from "react";
import { api } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Table, Td } from "../../components/ui";

export default function Stores() {
  const { data, loading, error, reload } = useApi("/stores");
  const [form, setForm] = useState({ name: "", address: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api.post("/stores", form);
      setForm({ name: "", address: "", city: "" });
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s) => {
    await api.patch(`/stores/${s._id}`, { isActive: !s.isActive });
    reload();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader title="Stores" subtitle="Inactive stores are hidden from customers." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErrorBox message={error} onRetry={reload} />
          {loading ? <Loading /> : (
            <Table headers={["Store", "Address", "City", "Status", ""]}>
              {data?.stores.map((s) => (
                <tr key={s._id}>
                  <Td className="font-medium">{s.name}</Td>
                  <Td>{s.address}</Td>
                  <Td>{s.city}</Td>
                  <Td>{s.isActive ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}</Td>
                  <Td><Button size="sm" variant="secondary" onClick={() => toggle(s)}>{s.isActive ? "Deactivate" : "Activate"}</Button></Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 font-semibold">Add store</h2>
          <ErrorBox message={formError} />
          <form onSubmit={create} className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={set("name")} required /></Field>
            <Field label="Address"><Input value={form.address} onChange={set("address")} required /></Field>
            <Field label="City"><Input value={form.city} onChange={set("city")} required /></Field>
            <Button type="submit" busy={busy} className="w-full">Create store</Button>
            <p className="text-xs text-slate-500">Every product gets a zero-stock inventory record in the new store.</p>
          </form>
        </Card>
      </div>
    </div>
  );
}
