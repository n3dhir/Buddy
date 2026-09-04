import { useCallback, useEffect, useState } from "react";
import { api, type Breakdown, type Entry, type Period, type Summary } from "./api";

const input =
  "w-full rounded-md border border-hairline bg-canvas-soft px-3 py-2 text-sm text-ink placeholder:text-mute focus:border-brand focus:outline-none";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-[#101010] hover:brightness-110 active:brightness-95";
const btnGhost =
  "rounded-md border border-hairline px-3 py-1.5 text-sm text-body hover:text-ink hover:border-mute";
const card = "rounded-lg border border-hairline bg-canvas p-6";
const eyebrow =
  "font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mute";

function money(n: number, currency = "TND") {
  return `${n.toFixed(2)} ${currency}`;
}

export default function App() {
  const [period, setPeriod] = useState<Period>("month");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState<"all" | "income" | "spending">("all");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, b, e] = await Promise.all([
        api.summary(period),
        api.breakdown(period),
        api.entries({ limit: "100" }),
      ]);
      setSummary(s);
      setBreakdown(b);
      setEntries(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = entries.filter((e) =>
    kind === "all" ? true : kind === "income" ? e.is_income : !e.is_income,
  );
  const maxTotal = Math.max(1, ...(breakdown?.breakdown.map((b) => b.total) ?? [1]));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="rise flex items-baseline justify-between">
        <div>
          <p className={eyebrow}>Rafiq · personal finance</p>
          <h1 className="mt-1 text-4xl font-normal tracking-tight text-white">
            Expenses
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? "rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-[#101010]"
                  : btnGhost
              }
            >
              {p}
            </button>
          ))}
          <button onClick={() => void load()} className={btnGhost} title="Reload from server">
            ↻
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-md border border-red-900 bg-red-950 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="rise mt-8 grid grid-cols-2 gap-4 md:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Stat label="Spent" value={summary ? money(summary.total_spent) : "—"} />
        <Stat label="Income" value={summary ? money(summary.total_income) : "—"} accent />
        <Stat
          label="Net"
          value={summary ? money(summary.net) : "—"}
          tone={summary && summary.net < 0 ? "text-red-300" : "text-brand"}
        />
        <Stat label="Entries" value={summary ? String(summary.count) : "—"} />
      </section>

      <section className={`${card} rise mt-4`} style={{ animationDelay: "120ms" }}>
        <p className={eyebrow}>Spending by category · {breakdown?.from} → {breakdown?.to}</p>
        <div className="mt-4 space-y-3">
          {breakdown?.breakdown.length === 0 && (
            <p className="text-sm text-mute">Nothing spent in this period.</p>
          )}
          {breakdown?.breakdown.map((b) => (
            <div key={b.category} className="grid grid-cols-[1fr_auto] items-center gap-2">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="rounded-full border border-hairline px-2.5 py-0.5 text-ink">
                    {b.category}
                  </span>
                  <span className="font-mono text-body">
                    {money(b.total)} · {b.count}×
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas-soft">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(b.total / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rise mt-8 grid gap-4 md:grid-cols-[320px_1fr]" style={{ animationDelay: "180ms" }}>
        <LogForm onDone={load} />
        <div className={card}>
          <div className="flex items-center justify-between">
            <p className={eyebrow}>Entries</p>
            <div className="flex gap-2">
              {(["all", "spending", "income"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={
                    kind === k
                      ? "rounded-full bg-brand px-3 py-1 text-xs font-semibold text-[#101010]"
                      : "rounded-full border border-hairline px-3 py-1 text-xs text-body hover:text-ink"
                  }
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-4 divide-y divide-hairline">
            {visible.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {e.note || e.category}{" "}
                    <span className="font-mono text-xs text-mute">#{e.id}</span>
                  </p>
                  <p className="font-mono text-xs text-mute">
                    {e.date} · {e.category}
                    {e.payment_method ? ` · ${e.payment_method}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`font-mono text-sm ${e.is_income ? "text-brand" : "text-ink"}`}>
                    {e.is_income ? "+" : "−"}{money(e.amount, e.currency)}
                  </span>
                  <button onClick={() => setEditing(e)} className={btnGhost}>edit</button>
                  <button
                    onClick={() =>
                      void api
                        .remove(e.id)
                        .then(load)
                        .catch((err: Error) => setError(err.message))
                    }
                    className={btnGhost}
                  >
                    del
                  </button>
                </div>
              </li>
            ))}
            {visible.length === 0 && <p className="py-4 text-sm text-mute">No entries.</p>}
          </ul>
        </div>
      </section>

      {editing && (
        <EditDialog entry={editing} onClose={() => setEditing(null)} onDone={load} />
      )}
    </div>
  );
}

function Stat({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: string }) {
  return (
    <div className={`${card} ${accent ? "!border-brand" : ""} p-5`}>
      <p className={eyebrow}>{label}</p>
      <p className={`mt-2 font-mono text-2xl ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function LogForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [payment, setPayment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      setMsg(null);
      await api.log(kind, {
        amount: Number(amount),
        category,
        ...(note ? { note } : {}),
        ...(date ? { date } : {}),
        ...(payment ? { payment_method: payment } : {}),
      });
      setAmount("");
      setCategory("");
      setNote("");
      setDate("");
      setPayment("");
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "save failed");
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <p className={eyebrow}>Log entry</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            className={
              kind === k
                ? "rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-[#101010]"
                : btnGhost
            }
          >
            {k}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <input className={input} placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <input className={input} placeholder="Category (food, salary…)" value={category} onChange={(e) => setCategory(e.target.value)} required />
        <input className={input} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className={input} placeholder="Payment (cash, card…)" value={payment} onChange={(e) => setPayment(e.target.value)} />
      </div>
      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
      <button type="submit" className={`${btnPrimary} mt-3 w-full`}>
        Save {kind}
      </button>
    </form>
  );
}

function EditDialog({ entry, onClose, onDone }: { entry: Entry; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [category, setCategory] = useState(entry.category);
  const [note, setNote] = useState(entry.note ?? "");
  const [date, setDate] = useState(entry.date);
  const [payment, setPayment] = useState(entry.payment_method ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      setMsg(null);
      await api.edit(entry.id, {
        amount: Number(amount),
        category,
        note: note || null,
        date,
        payment_method: payment || null,
      });
      onClose();
      onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "save failed");
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className={`${card} w-full max-w-md !bg-canvas-soft`}>
        <p className={eyebrow}>Edit #{entry.id}</p>
        <div className="mt-3 space-y-2">
          <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input className={input} value={category} onChange={(e) => setCategory(e.target.value)} required />
          <input className={input} placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={input} placeholder="Payment" value={payment} onChange={(e) => setPayment(e.target.value)} />
        </div>
        {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
        <div className="mt-3 flex gap-2">
          <button type="submit" className={`${btnPrimary} flex-1`}>Save</button>
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
