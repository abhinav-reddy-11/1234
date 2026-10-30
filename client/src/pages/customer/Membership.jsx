import { useEffect } from "react";
import { formatINR } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { Card, ErrorBox, Loading, PageHeader, TierBadge } from "../../components/ui";

const BENEFITS = {
  bronze: ["Free delivery on orders above ₹999", "7-day return window"],
  silver: ["5% off every order", "Free delivery above ₹499", "15-day return window", "Birthday coupon"],
  gold: ["10% off every order", "Free delivery on all orders", "30-day return window", "Priority packing & support", "Extended electronics warranty"],
};

export default function Membership() {
  const { data, loading, error, reload } = useApi("/membership/me");
  const { refreshUser } = useAuth();
  useEffect(() => { refreshUser(); }, [refreshUser]); // tier may have changed after a completed order

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const m = data.membership;
  const nextThreshold = m.nextTier ? m.thresholds[m.nextTier] : m.thresholds.gold;
  const progress = Math.min(100, Math.round((m.totalEligibleSpend / nextThreshold) * 100));

  return (
    <div>
      <PageHeader title="Membership" subtitle="Tiers upgrade automatically based on completed-order spending." />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Your tier</p>
            <div className="mt-1 flex items-center gap-3">
              <TierBadge tier={m.tier} />
              <span className="text-sm text-slate-600">{m.discountPercent}% discount on every order</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Eligible spend</p>
            <p className="text-2xl font-bold">{formatINR(m.totalEligibleSpend)}</p>
          </div>
        </div>
        <div className="mt-5">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {m.nextTier
              ? <>Spend <b>{formatINR(m.amountToNextTier)}</b> more to reach <b className="capitalize">{m.nextTier}</b>.</>
              : "You're at the highest tier. Enjoy your Gold benefits!"}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {["bronze", "silver", "gold"].map((t) => (
          <Card key={t} className={t === m.tier ? "ring-2 ring-indigo-500" : ""}>
            <div className="flex items-center justify-between">
              <TierBadge tier={t} />
              {t === m.tier && <span className="text-xs font-semibold text-indigo-600">CURRENT</span>}
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {t === "bronze" ? `Below ${formatINR(m.thresholds.silver)}` : t === "silver" ? `${formatINR(m.thresholds.silver)} – ${formatINR(m.thresholds.gold - 1)}` : `${formatINR(m.thresholds.gold)} and above`}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {BENEFITS[t].map((b) => <li key={b}>✓ {b}</li>)}
            </ul>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">Full benefit details are in our policies. Ask the AI Assistant for specifics with citations.</p>
    </div>
  );
}
