import { useCallback, useEffect, useState } from "react";
import { api, getUser, setSession, type AuthUser, type Breakdown, type Entry, type Period, type Summary } from "./api";
import logoUrl from "./assets/logo.svg";

const input =
  "w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-brand-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-brand/50";
const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-hover active:brightness-95";
const btnSecondary =
  "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-hairline bg-surface-1 px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-2";
const btnGhost =
  "inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm text-ink-subtle hover:bg-surface-2 hover:text-ink";
const card = "edge rounded-xl border border-hairline bg-surface-1";
const eyebrow = "text-[13px] font-medium tracking-[0.4px] text-ink-subtle";

function money(n: number) {
  return n.toFixed(2);
}

function greeting(): string {
  const h = new Date(Date.now() + 3_600_000).getUTCHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function periodTitle(s: Summary | null): string {
  if (!s) return "Overview";
  if (s.period === "week") return "Last 7 days";
  if (s.period === "year") return s.to.slice(0, 4);
  return new Date(`${s.to}T00:00:00`).toLocaleString("en", { month: "long" });
}

export default function App() {
  const [period, setPeriod] = useState<Period>("month");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState<"all" | "spending" | "income">("all");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [locked, setLocked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => getUser());

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
      setLocked(false);
    } catch (err) {
      if ((err as { status?: number })?.status === 401) setLocked(true);
      else setError(err instanceof Error ? err.message : "load failed");
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
    <div className="min-h-screen bg-canvas text-ink">
      {/* Top nav */}
      <nav className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Rafiq logo" className="h-7 w-7 rounded-lg" />
            <span className="hidden text-sm font-medium min-[420px]:inline">Rafiq</span>
            <span className="hidden rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-muted sm:inline">
              Tunis · UTC+1
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-hairline bg-canvas p-1">
            {(["week", "month", "year"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  period === p
                    ? "min-h-[32px] rounded-full bg-surface-2 px-3.5 text-sm font-medium text-ink"
                    : "min-h-[32px] rounded-full px-3.5 text-sm text-ink-subtle hover:text-ink"
                }
              >
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} className={btnGhost} title="Reload from server">
            <span aria-hidden>↻</span>
            <span className="ml-1.5 hidden md:inline">Refresh</span>
          </button>
          {user && (
            <>
              <span className="hidden rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink-muted sm:inline">
                {user.username} · {user.role}
              </span>
              <button
                onClick={() => {
                  setSession(null, null);
                  setUser(null);
                  setLocked(true);
                }}
                className={btnGhost}
                title="Log out"
              >
                ⎋
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* Hero */}
        <header className="rise pt-10 sm:pt-14">
          <p className={eyebrow}>
            {greeting()} · {summary ? `${summary.from} → ${summary.to}` : "personal finance"}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {periodTitle(summary)}
            </h1>
            {summary && (
              <p className="tnum font-mono text-lg sm:text-xl">
                <span className={summary.net < 0 ? "text-ink" : "text-success"}>
                  {summary.net < 0 ? "−" : "+"}
                  {money(Math.abs(summary.net))}
                </span>{" "}
                <span className="text-sm text-ink-tertiary">TND net</span>
              </p>
            )}
          </div>
        </header>

        {error && (
          <p className="mt-6 rounded-lg border border-red-900 bg-red-950 px-4 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        {/* Stats */}
        <section
          className="rise mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
          style={{ animationDelay: "60ms" }}
        >
          <Stat label="Spent" value={summary ? money(summary.total_spent) : "—"} suffix="TND" />
          <Stat label="Income" value={summary ? money(summary.total_income) : "—"} suffix="TND" tone="text-success" />
          <Stat
            label="Net"
            value={summary ? `${summary.net < 0 ? "−" : "+"}${money(Math.abs(summary.net))}` : "—"}
            suffix="TND"
            tone={summary && summary.net < 0 ? "text-ink" : "text-success"}
          />
          <Stat label="Entries" value={summary ? String(summary.count) : "—"} />
        </section>

        {/* Breakdown */}
        <section className={`${card} rise mt-3 p-6 sm:mt-4`} style={{ animationDelay: "120ms" }}>
          <div className="flex items-baseline justify-between gap-2">
            <p className={eyebrow}>Spending by category</p>
            <p className="font-mono text-xs text-ink-tertiary">
              {breakdown?.from} → {breakdown?.to}
            </p>
          </div>
          <div className="mt-5 space-y-4">
            {breakdown?.breakdown.length === 0 && (
              <p className="text-sm text-ink-subtle">Nothing spent in this period.</p>
            )}
            {breakdown?.breakdown.map((b) => (
              <div key={b.category}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 text-ink">
                    {b.category}
                  </span>
                  <span className="tnum font-mono text-[13px] text-ink-muted">
                    {money(b.total)} · {b.count}×
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-500"
                    style={{ width: `${Math.max(4, (b.total / maxTotal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Entries + form */}
        <section
          className="rise mt-8 grid items-start gap-4 lg:grid-cols-[1fr_340px]"
          style={{ animationDelay: "180ms" }}
        >
          <div className={`${card} order-2 p-6 lg:order-1`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={eyebrow}>Entries</p>
              <div className="flex gap-1 rounded-full border border-hairline p-1">
                {(["all", "spending", "income"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={
                      kind === k
                        ? "min-h-[32px] rounded-full bg-surface-2 px-3 text-[13px] font-medium text-ink"
                        : "min-h-[32px] rounded-full px-3 text-[13px] text-ink-subtle hover:text-ink"
                    }
                  >
                    {k[0].toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-2 divide-y divide-hairline">
              {visible.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-4">
                  <span
                    className={`h-9 w-1 shrink-0 rounded-full ${e.is_income ? "bg-success" : "bg-brand"}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-ink">
                      {e.note || e.category}{" "}
                      <span className="font-mono text-xs text-ink-tertiary">#{e.id}</span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-ink-subtle">
                      {e.date} · {e.category}
                      {e.payment_method ? ` · ${e.payment_method}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <span className={`tnum font-mono text-sm ${e.is_income ? "text-success" : "text-ink"}`}>
                      {e.is_income ? "+" : "−"}
                      {money(e.amount)}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(e)} className={btnGhost} aria-label={`Edit entry ${e.id}`}>
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          void api
                            .remove(e.id)
                            .then(load)
                            .catch((err: Error) => setError(err.message))
                        }
                        className={btnGhost}
                        aria-label={`Delete entry ${e.id}`}
                      >
                        Del
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {visible.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-subtle">No entries.</p>
              )}
            </ul>
          </div>

          <LogForm onDone={load} />
        </section>

        {user?.role === "admin" && <UsersPanel />}

        <footer className="mt-12 border-t border-hairline pt-6 text-xs text-ink-tertiary">
          Rafiq · Tunis time (UTC+1) · refresh to sync changes made via chat
        </footer>
      </main>

      {editing && (
        <EditDialog entry={editing} onClose={() => setEditing(null)} onDone={load} />
      )}

      {locked && (
        <AuthGate
          onDone={(u) => {
            setUser(u);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone?: string }) {
  return (
    <div className={`${card} p-5`}>
      <p className={eyebrow}>{label}</p>
      <p className={`tnum mt-2 text-2xl font-semibold tracking-tight sm:text-[28px] ${tone ?? "text-ink"}`}>
        {value}
        {suffix && <span className="ml-1.5 text-sm font-normal text-ink-tertiary">{suffix}</span>}
      </p>
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

function UsersPanel() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const loadUsers = useCallback(() => {
    api
      .users()
      .then(setUsers)
      .catch((err: Error) => setMsg(err.message));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <section className={`${card} mt-4 p-6`}>
      <p className={eyebrow}>Users · admin</p>
      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
      <ul className="mt-2 divide-y divide-hairline">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2 py-2.5">
            <span className="font-mono text-sm text-ink">
              {u.username} <span className="text-ink-tertiary">#{u.id}</span>
            </span>
            <select
              className="rounded-md border border-hairline bg-canvas px-2 py-1.5 text-sm text-ink"
              value={u.role}
              aria-label={`Role for ${u.username}`}
              onChange={(e) =>
                api
                  .setRole(u.id, e.target.value)
                  .then(loadUsers)
                  .catch((err: Error) => setMsg(err.message))
              }
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </li>
        ))}
      </ul>
    </section>
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
function AuthGate({ onDone }: { onDone: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      setMsg(null);
      const { token, user } =
        mode === "login"
          ? await api.login(username, password)
          : await api.register(username, password);
      setSession(token, user);
      setUsername("");
      setPassword("");
      onDone(user);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "auth failed");
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-canvas p-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm p-6`}>
        <p className={eyebrow}>{mode === "login" ? "Welcome back" : "Create account"}</p>
        <div className="mt-3 space-y-2">
          <input
            className={input}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
          <input
            className={input}
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
        <button type="submit" className={`${btnPrimary} mt-3 w-full`}>
          {mode === "login" ? "Log in" : "Register"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMsg(null);
          }}
          className="mt-2 w-full text-center text-sm text-ink-subtle hover:text-ink"
        >
          {mode === "login" ? "No account? Register" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
