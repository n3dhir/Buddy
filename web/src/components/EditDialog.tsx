import { useState } from "react";
import { api, type Entry } from "../api";
import { btnPrimary, btnSecondary, eyebrow, input } from "../ui";

export default function EditDialog({ entry, onClose, onDone }: { entry: Entry; onClose: () => void; onDone: () => void }) {
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
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="edge w-full max-w-md rounded-t-2xl border border-hairline bg-surface-1 p-6 sm:rounded-xl"
      >
        <p className={eyebrow}>Edit #{entry.id}</p>
        <div className="mt-3 space-y-2">
          <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required aria-label="Amount" />
          <input className={input} value={category} onChange={(e) => setCategory(e.target.value)} required aria-label="Category" />
          <input className={input} placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <input className={input} placeholder="Payment" value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment method" />
        </div>
        {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
        <div className="mt-4 flex gap-2">
          <button type="submit" className={`${btnPrimary} flex-1`}>Save</button>
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
