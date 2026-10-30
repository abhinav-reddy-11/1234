import { formatDate } from "../services/api";
import { statusLabel } from "./ui";

const FLOW = {
  delivery: ["placed", "packed", "out_for_delivery", "completed"],
  takeaway: ["placed", "packed", "ready_for_pickup", "completed"],
};

// Visual step tracker for an order's status.
export default function OrderTimeline({ order }) {
  if (order.status === "cancelled") {
    return <p className="text-sm font-medium text-rose-600">This order was cancelled and refunded.</p>;
  }
  const steps = FLOW[order.fulfilment];
  const currentIndex = steps.indexOf(order.status);
  const when = Object.fromEntries(order.statusHistory.map((h) => [h.status, h.at]));

  return (
    <ol className="flex flex-wrap items-start gap-y-3">
      {steps.map((s, i) => {
        const done = i <= currentIndex;
        return (
          <li key={s} className="flex items-center">
            <div className="flex flex-col items-center text-center">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                {done ? "✓" : i + 1}
              </span>
              <span className={`mt-1 w-24 text-xs ${done ? "font-medium text-slate-800" : "text-slate-400"}`}>{statusLabel(s)}</span>
              {when[s] && <span className="text-[10px] text-slate-400">{formatDate(when[s])}</span>}
            </div>
            {i < steps.length - 1 && <span className={`mb-8 h-0.5 w-8 ${i < currentIndex ? "bg-indigo-600" : "bg-slate-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
