import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { Badge, Button } from "./ui";

const SUGGESTIONS = [
  "How many days do I have to return an item?",
  "Do I get free delivery?",
  "What are the benefits of my membership tier?",
  "Can I cancel an order after it is packed?",
];

function Message({ m }) {
  if (m.role === "user") {
    return <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm text-white">{m.text}</div>;
  }
  return (
    <div className="max-w-[90%] space-y-2">
      <div className={`rounded-2xl rounded-bl-sm px-4 py-3 text-sm ${m.fallback ? "border border-amber-200 bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-800"}`}>
        {m.text}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {m.fallback ? <Badge color="yellow">Fallback · {m.reason?.replace(/_/g, " ")}</Badge> : <Badge color={m.confidence === "high" ? "green" : "blue"}>Confidence: {m.confidence}</Badge>}
        <span className="text-slate-400">answered for {m.tier} tier</span>
      </div>
      {m.citations?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</p>
          {m.citations.map((c) => (
            <div key={c.chunkId} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <p className="font-semibold text-slate-800">
                📄 {c.document} <span className="font-normal text-slate-500">v{c.version} · {c.section}{c.page ? ` · page ${c.page}` : ""}</span>
              </p>
              <p className="mt-1 text-slate-600">“{c.snippet}”</p>
              <p className="mt-1 text-slate-400">Chunk {String(c.chunkId).slice(-6)} · similarity {c.score}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// RAG chat with citations. `previewTier` is only used by admins to test tier filtering.
export default function PolicyChat({ previewTier }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const ask = async (text) => {
    const q = (text ?? question).trim();
    if (q.length < 3 || busy) return;
    setMessages((ms) => [...ms, { role: "user", text: q }]);
    setQuestion("");
    setBusy(true);
    try {
      const r = await api.post("/ai/chat", { question: q, ...(previewTier && { tier: previewTier }) });
      setMessages((ms) => [...ms, { role: "ai", text: r.answer, fallback: r.fallback, reason: r.reason, confidence: r.confidence, citations: r.citations, tier: r.tier }]);
    } catch (err) {
      setMessages((ms) => [...ms, { role: "ai", text: err.message, fallback: true, reason: "error" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[32rem] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <p className="font-semibold text-slate-700">Ask about returns, delivery or membership benefits</p>
            <p className="mt-1 text-sm text-slate-500">Answers come only from approved policies for your tier, with sources.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => <Message key={i} m={m} />)}
        {busy && <div className="text-sm text-slate-400">Searching policies…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2 border-t border-slate-200 p-3">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="Type your policy question..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <Button type="submit" busy={busy} disabled={question.trim().length < 3}>Ask</Button>
      </form>
    </div>
  );
}
