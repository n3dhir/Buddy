import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { api, getToken, getUser, setSession, type AuthUser, type Breakdown, type Entry, type Period, type Summary } from "../api";
import { btnGhost, card, eyebrow, greeting, money, periodTitle } from "../ui";
import BottomBar from "../components/BottomBar";
import ConfirmDialog from "../components/ConfirmDialog";
import EditDialog from "../components/EditDialog";
import EmptyState from "../components/EmptyState";
import EntryModal from "../components/EntryModal";
import { PencilIcon, PlusIcon, RefreshIcon, TrashIcon } from "../components/icons";
import DashboardSkeleton from "../components/Skeleton";
import Stat from "../components/Stat";
import Toaster, { toast } from "../components/Toaster";
import TopNav from "../components/TopNav";

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState<"all" | "spending" | "income">("all");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const [showForm, setShowForm] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [cycle, setCycle] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  function logout() {
    setSession(null, null);
    setUser(null);
    setConfirmLogout(false);
    navigate("/login");
  }

  function removeEntry(id: number) {
    void api
      .remove(id)
      .then(() => {
        toast("Entry deleted");
        setPendingDelete(null);
        load();
      })
      .catch((err: Error) => {
        setPendingDelete(null);
        setError(err.message);
      });
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
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
      if ((err as { status?: number })?.status === 401) {
        setSession(null, null);
        setUser(null);
        navigate("/login");
      } else setError(err instanceof Error ? err.message : "load failed");
    } finally {
      setLoading(false);
      setCycle((c) => c + 1);
      setReady(true);
    }
  }, [period]);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      navigate("/login");
      return;
    }
    if ((location.state as { fresh?: boolean } | null)?.fresh) {
      setShowForm(true);
      navigate(location.pathname, { replace: true });
    }
    void load();
  }, [load, navigate]);

  const visible = entries.filter((e) =>
    kind === "all" ? true : kind === "income" ? e.is_income : !e.is_income,
  );
  const maxTotal = Math.max(1, ...(breakdown?.breakdown.map((b) => b.total) ?? [1]));

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <TopNav user={user} onLogout={() => setConfirmLogout(true)} />

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-16">
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

        {/* Controls */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface-1 p-1">
            {(["week", "month", "year"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  period === p
                    ? "min-h-[36px] rounded-full bg-surface-2 px-4 text-sm font-medium text-ink"
                    : "min-h-[36px] rounded-full px-4 text-sm text-ink-subtle hover:text-ink"
                }
              >
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load()}
            className={btnGhost}
            title="Reload from server"
            aria-label="Reload dashboard"
          >
            <span aria-hidden className={loading ? "inline-block animate-spin" : undefined}>
              <RefreshIcon />
            </span>
            <span className="ml-1.5 hidden md:inline">Refresh</span>
          </button>
        </div>

        {/* Stats */}
        <section
          key={`stats-${cycle}`}
          className="rise mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
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
        <section key={`breakdown-${cycle}`} className={`${card} rise mt-3 p-6 sm:mt-4`} style={{ animationDelay: "120ms" }}>
          <div className="flex items-baseline justify-between gap-2">
            <p className={eyebrow}>Spending by category</p>
            <p className="font-mono text-xs text-ink-tertiary">
              {breakdown?.from} → {breakdown?.to}
            </p>
          </div>
          <div className="mt-5 space-y-4">
            {breakdown?.breakdown.length === 0 && (
              <EmptyState title="Nothing spent here yet" hint="Log your first expense and it will show up by category." />
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

        {/* Entries */}
        <section key={`entries-${cycle}`} className={`${card} rise mt-8 p-6`} style={{ animationDelay: "180ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={eyebrow}>Entries</p>
            <div className="flex items-center gap-2">
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
              <button onClick={() => setShowForm(true)} className={btnGhost}>
                + New
              </button>
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
                    <div className="flex gap-1 text-lg">
                      <button onClick={() => setEditing(e)} className={btnGhost} aria-label={`Edit entry ${e.id}`} title="Edit">
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => setPendingDelete(e)}
                        className={btnGhost}
                        aria-label={`Delete entry ${e.id}`}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {visible.length === 0 && (
                <div className="py-4">
                  <EmptyState title="No entries yet" hint="Tap + below — or send it from chat." />
                </div>
              )}
            </ul>
        </section>

        <footer className="mt-12 border-t border-hairline pt-6 text-xs text-ink-tertiary">
          Buddy · Tunis time (UTC+1) · refresh to sync changes made via chat
        </footer>
      </main>

      <button
        onClick={() => setShowForm(true)}
        aria-label="Log new entry"
        className="fixed bottom-6 right-6 z-10 hidden h-14 w-14 items-center justify-center rounded-full bg-brand text-xl text-white shadow-xl hover:bg-brand-hover sm:flex"
      >
        <PlusIcon />
      </button>
      <div className="sm:hidden">
        <BottomBar onNew={() => setShowForm(true)} />
      </div>

      {showForm && <EntryModal onClose={() => setShowForm(false)} onDone={load} />}
      {editing && (
        <EditDialog entry={editing} onClose={() => setEditing(null)} onDone={load} />
      )}
      {confirmLogout && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need your password to log back in."
          confirmLabel="Log out"
          onClose={() => setConfirmLogout(false)}
          onConfirm={logout}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this entry?"
          message={`${pendingDelete.note || pendingDelete.category} · ${money(pendingDelete.amount)} TND — this cannot be undone.`}
          confirmLabel="Delete"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => removeEntry(pendingDelete.id)}
        />
      )}
      <Toaster />
    </div>
  );
}
