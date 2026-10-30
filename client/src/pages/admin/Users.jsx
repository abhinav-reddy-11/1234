import { useState } from "react";
import { api, formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Select, Table, Td, TierBadge } from "../../components/ui";

export default function Users() {
  const [role, setRole] = useState("");
  const { data, loading, error, reload } = useApi(`/admin/users${role ? `?role=${role}` : ""}`);
  const { data: storeData } = useApi("/stores");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "manager", storeId: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api.post("/admin/users", form);
      setForm({ name: "", email: "", password: "", role: "manager", storeId: "" });
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (u, body) => {
    setActionError("");
    try {
      await api.patch(`/admin/users/${u._id}`, body);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader title="Users & managers" subtitle="Customers self-register. Managers and admins are created here." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 w-48">
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role filter">
              <option value="">All roles</option>
              <option value="customer">Customers</option>
              <option value="manager">Managers</option>
              <option value="admin">Admins</option>
            </Select>
          </div>
          <ErrorBox message={error || actionError} onRetry={error ? reload : undefined} />
          {loading ? <Loading /> : (
            <Table headers={["Name", "Role", "Store / tier", "Status", ""]}>
              {data?.users.map((u) => (
                <tr key={u._id}>
                  <Td><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></Td>
                  <Td><Badge color={u.role === "admin" ? "purple" : u.role === "manager" ? "indigo" : "gray"}>{u.role}</Badge></Td>
                  <Td>
                    {u.role === "manager" && (
                      <Select value={u.storeId?._id || ""} onChange={(e) => update(u, { storeId: e.target.value })} aria-label="Assigned store">
                        {storeData?.stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                      </Select>
                    )}
                    {u.role === "customer" && <div className="flex items-center gap-2"><TierBadge tier={u.tier} /><span className="text-xs text-slate-500">{formatINR(u.totalEligibleSpend)}</span></div>}
                  </Td>
                  <Td>{u.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Disabled</Badge>}</Td>
                  <Td><Button size="sm" variant="secondary" onClick={() => update(u, { isActive: !u.isActive })}>{u.isActive ? "Disable" : "Enable"}</Button></Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 font-semibold">Create staff account</h2>
          <ErrorBox message={formError} />
          <form onSubmit={create} className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={set("name")} required /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} required /></Field>
            <Field label="Temporary password" hint="At least 8 characters"><Input type="password" value={form.password} onChange={set("password")} required /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={set("role")}>
                <option value="manager">Store manager</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            {form.role === "manager" && (
              <Field label="Assigned store">
                <Select value={form.storeId} onChange={set("storeId")} required>
                  <option value="">Select store</option>
                  {storeData?.stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </Select>
              </Field>
            )}
            <Button type="submit" busy={busy} className="w-full">Create account</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
