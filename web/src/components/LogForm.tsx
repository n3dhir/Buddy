import { useState } from "react";
import { api } from "../api";
import { btnPrimary, card, eyebrow, input } from "../ui";

export default function LogForm({ onDone }: { onDone: () => void }) {
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
    <form onSubmit={submit} className={`${card} order-1 p-6 lg:order-2 lg:sticky lg:top-[72px]`}>
      <p className={eyebrow}>Log entry</p>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-hairline p-1">
        {(["expense", "income"] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            className={
              kind === k
                ? "min-h-[40px] rounded-md bg-surface-2 text-sm font-medium text-ink"
                : "min-h-[40px] rounded-md text-sm text-ink-subtle hover:text-ink"
            }
          >
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <input className={input} placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <input className={input} placeholder="Category (food, salary…)" value={category} onChange={(e) => setCategory(e.target.value)} required />
        <input className={input} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <input className={input} placeholder="Payment (cash, card…)" value={payment} onChange={(e) => setPayment(e.target.value)} />
      </div>
      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
      <button type="submit" className={`${btnPrimary} mt-3 w-full`}>
        Save {kind}
      </button>
    </form>
  );
}
