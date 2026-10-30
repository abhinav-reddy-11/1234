import { useState } from "react";
import { api, formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Button, Card, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select, Table, Td, Textarea } from "../../components/ui";

const EMPTY = { name: "", description: "", category: "", price: "", tags: "", attributes: "" };

// attributes are edited as "key: value" lines
const attrsToText = (a = {}) => Object.entries(a).map(([k, v]) => `${k}: ${v}`).join("\n");
const textToAttrs = (t) => Object.fromEntries(
  t.split("\n").map((l) => l.split(":")).filter((p) => p.length >= 2 && p[0].trim()).map(([k, ...v]) => [k.trim(), v.join(":").trim()])
);

export default function Products() {
  const { data, loading, error, reload } = useApi("/products?sort=name");
  const { data: catData, reload: reloadCats } = useApi("/categories");
  const [editing, setEditing] = useState(null); // null | "new" | product
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [newCat, setNewCat] = useState("");
  const [catError, setCatError] = useState("");

  const open = (p) => {
    setEditing(p || "new");
    setFormError("");
    setForm(p ? { name: p.name, description: p.description, category: p.category?._id, price: p.price, tags: p.tags.join(", "), attributes: attrsToText(p.attributes) } : EMPTY);
  };

  const save = async () => {
    setBusy(true);
    setFormError("");
    const body = {
      name: form.name, description: form.description, category: form.category, price: Number(form.price),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), attributes: textToAttrs(form.attributes),
    };
    try {
      if (editing === "new") await api.post("/products", body);
      else await api.patch(`/products/${editing._id}`, body);
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (p) => {
    if (!window.confirm(`Hide "${p.name}" from the catalogue?`)) return;
    await api.patch(`/products/${p._id}`, { isActive: false });
    reload();
  };

  const addCategory = async (e) => {
    e.preventDefault();
    setCatError("");
    try {
      await api.post("/categories", { name: newCat });
      setNewCat("");
      reloadCats();
    } catch (err) {
      setCatError(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader title="Products & categories" subtitle="The catalogue is shared by all stores. New products start with zero stock in every store."
        actions={<Button onClick={() => open(null)}>Add product</Button>} />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <ErrorBox message={error} onRetry={reload} />
          {loading ? <Loading /> : (
            <Table headers={["Product", "Category", "Price", "Tags", ""]}>
              {data?.products.map((p) => (
                <tr key={p._id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td>{p.category?.name}</Td>
                  <Td>{formatINR(p.price)}</Td>
                  <Td className="text-xs text-slate-500">{p.tags.join(", ")}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => open(p)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => deactivate(p)}>Hide</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 font-semibold">Categories</h2>
          <ul className="mb-4 space-y-1 text-sm">
            {catData?.categories.map((c) => <li key={c._id} className="rounded bg-slate-50 px-3 py-1.5">{c.name}</li>)}
          </ul>
          <ErrorBox message={catError} />
          <form onSubmit={addCategory} className="flex gap-2">
            <Input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} required />
            <Button type="submit" size="sm">Add</Button>
          </form>
        </Card>
      </div>

      <Modal open={Boolean(editing)} title={editing === "new" ? "Add product" : "Edit product"} onClose={() => setEditing(null)}>
        <ErrorBox message={formError} />
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={set("name")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={form.category} onChange={set("category")}>
                <option value="">Select</option>
                {catData?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Price (₹)"><Input type="number" min="0" value={form.price} onChange={set("price")} /></Field>
          </div>
          <Field label="Description"><Textarea value={form.description} onChange={set("description")} /></Field>
          <Field label="Tags" hint="Comma separated, used for search and AI recommendations"><Input value={form.tags} onChange={set("tags")} /></Field>
          <Field label="Attributes" hint="One per line, e.g. battery: 30 hours"><Textarea value={form.attributes} onChange={set("attributes")} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button busy={busy} onClick={save}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
