import { useState } from "react";
import { api, formatDate } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { Button, Card, ErrorBox, Field, Input, Loading, PageHeader, StatusBadge, SuccessBox, Table, Td, TierBadge } from "../../components/ui";

const TIERS = ["bronze", "silver", "gold"];

function TierPicker({ value, onChange }) {
  return (
    <div className="flex gap-3">
      {TIERS.map((t) => (
        <label key={t} className="flex items-center gap-1.5 text-sm capitalize">
          <input type="checkbox" className="accent-indigo-600" checked={value.includes(t)}
            onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))} />
          {t}
        </label>
      ))}
    </div>
  );
}

export default function Policies() {
  const { data, loading, error, reload } = useApi("/admin/policies");
  const [title, setTitle] = useState("");
  const [tiers, setTiers] = useState([...TIERS]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [editTiers, setEditTiers] = useState(null); // { id, tiers }

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return setActionError("Choose a .md, .txt or .json file");
    if (!tiers.length) return setActionError("Select at least one tier");
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("appliesToTiers", tiers.join(","));
      form.append("file", file);
      const r = await api.upload("/admin/policies", form);
      setNotice(`Uploaded "${r.document.title}" v${r.document.version}: ${r.document.chunkCount} chunks embedded. Approve it to make it searchable.`);
      setTitle("");
      setFile(null);
      e.target.reset();
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, okMsg) => {
    setActionError("");
    setNotice("");
    try {
      const r = await fn();
      setNotice(typeof okMsg === "function" ? okMsg(r) : okMsg);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Policy documents (RAG)" subtitle="Uploads are chunked and embedded, but stay pending until approved. Approving a new version archives the old one." />
      <SuccessBox message={notice} />
      <ErrorBox message={actionError} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErrorBox message={error} onRetry={reload} />
          {loading ? <Loading /> : (
            <Table headers={["Document", "Version", "Applies to", "Status", "Chunks", "Actions"]}>
              {data?.documents.map((d) => (
                <tr key={d._id} className={d.status === "archived" || d.status === "rejected" ? "opacity-60" : ""}>
                  <Td>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-slate-500">{d.fileName} · {formatDate(d.createdAt)} · by {d.uploadedBy?.name}</p>
                    {d.approvedBy && <p className="text-xs text-slate-500">Approved by {d.approvedBy.name}</p>}
                  </Td>
                  <Td>v{d.version}</Td>
                  <Td>
                    {editTiers?.id === d._id ? (
                      <div className="space-y-2">
                        <TierPicker value={editTiers.tiers} onChange={(t) => setEditTiers({ ...editTiers, tiers: t })} />
                        <div className="flex gap-1">
                          <Button size="sm" disabled={!editTiers.tiers.length}
                            onClick={() => act(() => api.patch(`/admin/policies/${d._id}/tiers`, { appliesToTiers: editTiers.tiers }), "Membership applicability updated.").then(() => setEditTiers(null))}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditTiers(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">{d.appliesToTiers.map((t) => <TierBadge key={t} tier={t} />)}</div>
                    )}
                  </Td>
                  <Td><StatusBadge status={d.status} /></Td>
                  <Td>{d.chunkCount}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {d.status === "pending" && (
                        <>
                          <Button size="sm" variant="success" onClick={() => act(() => api.patch(`/admin/policies/${d._id}/approve`),
                            (r) => `Approved v${d.version}.${r.archivedVersions ? ` ${r.archivedVersions} older version(s) archived.` : ""}`)}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => act(() => api.patch(`/admin/policies/${d._id}/reject`), "Document rejected.")}>Reject</Button>
                        </>
                      )}
                      {["pending", "approved"].includes(d.status) && editTiers?.id !== d._id && (
                        <Button size="sm" variant="secondary" onClick={() => setEditTiers({ id: d._id, tiers: d.appliesToTiers })}>Tiers</Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <Card className="h-fit">
          <h2 className="mb-3 font-semibold">Upload policy</h2>
          <form onSubmit={upload} className="space-y-3">
            <Field label="Title" hint="Use an existing title to upload a new version">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required list="policy-titles" />
              <datalist id="policy-titles">{[...new Set(data?.documents.map((d) => d.title))].map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Applies to tiers"><TierPicker value={tiers} onChange={setTiers} /></Field>
            <Field label="File" hint="Text-based: .md, .txt or .json (max 4 MB)">
              <input type="file" accept=".md,.txt,.json" onChange={(e) => setFile(e.target.files[0])} className="text-sm" />
            </Field>
            <Button type="submit" busy={busy} className="w-full">{busy ? "Embedding..." : "Upload & embed"}</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
