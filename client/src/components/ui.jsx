// Small reusable UI building blocks used across all pages.

export function Button({ variant = "primary", size = "md", className = "", busy, children, ...props }) {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
    danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy && <Spinner small />}
      {children}
    </button>
  );
}

export function Card({ className = "", children }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ small }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? "h-3.5 w-3.5" : "h-6 w-6 text-indigo-600"}`}
    />
  );
}

export function Loading({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner /> {text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <span>{message}</span>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function SuccessBox({ message }) {
  if (!message) return null;
  return <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>;
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const BADGE_COLORS = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-700",
  purple: "bg-violet-100 text-violet-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export function Badge({ color = "gray", children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_COLORS[color]}`}>{children}</span>;
}

const TIER_STYLE = {
  gold: "bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-950",
  silver: "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800",
  bronze: "bg-gradient-to-r from-orange-200 to-amber-300 text-orange-900",
};
export function TierBadge({ tier }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${TIER_STYLE[tier]}`}>{tier}</span>;
}

const STATUS_COLOR = {
  placed: "blue", packed: "indigo", out_for_delivery: "purple", ready_for_pickup: "purple",
  completed: "green", cancelled: "red",
  draft: "gray", submitted: "blue", approved: "indigo", received: "green", rejected: "red",
  pending: "yellow", archived: "gray",
};
export const statusLabel = (s) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export function StatusBadge({ status }) {
  return <Badge color={STATUS_COLOR[status] || "gray"}>{statusLabel(status)}</Badge>;
}

export function StatCard({ label, value, hint, tone = "slate" }) {
  const tones = { slate: "text-slate-900", red: "text-rose-600", green: "text-emerald-600", amber: "text-amber-600", indigo: "text-indigo-600" };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export const Input = (props) => <input className={inputClass} {...props} />;
export const Textarea = (props) => <textarea className={inputClass} rows={3} {...props} />;
export function Select({ children, ...props }) {
  return <select className={inputClass} {...props}>{children}</select>;
}

export function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = "" }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;

export function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-600">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
