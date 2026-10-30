import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, homePathFor } from "../../context/AuthContext";
import { Button, ErrorBox, Field, Input } from "../../components/ui";
import { AuthShell } from "./Login";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to={homePathFor(user.role)} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return setError("Password must be at least 8 characters long");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    setBusy(true);
    setError("");
    try {
      await register(form.name, form.email, form.password);
      navigate("/shop");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="New members start at Bronze and upgrade automatically as they shop.">
      <ErrorBox message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input value={form.name} onChange={set("name")} required /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} required /></Field>
        <Field label="Password" hint="At least 8 characters"><Input type="password" value={form.password} onChange={set("password")} required /></Field>
        <Field label="Confirm password"><Input type="password" value={form.confirm} onChange={set("confirm")} required /></Field>
        <Button type="submit" busy={busy} className="w-full">Create account</Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
