import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, homePathFor } from "../../context/AuthContext";
import { Button, ErrorBox, Field, Input } from "../../components/ui";

const DEMO_ACCOUNTS = [
  ["Gold customer", "gold@retailpulse.demo"],
  ["Silver customer", "silver@retailpulse.demo"],
  ["Bronze customer", "bronze@retailpulse.demo"],
  ["Manager (Hyderabad)", "manager.hyderabad@retailpulse.demo"],
  ["Admin", "admin@retailpulse.demo"],
];

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10" />
          <span className="text-2xl font-bold text-slate-900">RetailPulse AI</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(email, password);
      navigate(homePathFor(u.role));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to shop, manage your store or run the organisation.">
      <ErrorBox message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <Button type="submit" busy={busy} className="w-full">Log in</Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        New customer? <Link to="/register" className="font-medium text-indigo-600 hover:underline">Create an account</Link>
      </p>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Demo accounts (password Demo@123)</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map(([label, demoEmail]) => (
            <button
              key={demoEmail}
              type="button"
              onClick={() => { setEmail(demoEmail); setPassword("Demo@123"); }}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
