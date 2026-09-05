import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, getToken, getUser, setSession, type AuthUser, type Breakdown, type Entry, type Period, type Summary } from "../api";
import logoUrl from "../assets/logo.svg";
import { btnGhost, card, eyebrow, greeting, money, periodTitle } from "../ui";
import EditDialog from "../components/EditDialog";
import LogForm from "../components/LogForm";
import Stat from "../components/Stat";
import TokensPanel from "../components/TokensPanel";

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
  const navigate = useNavigate();

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
      if ((err as { status?: number })?.status === 401) {
        setSession(null, null);
        setUser(null);
        navigate("/login");
      } else setError(err instanceof Error ? err.message : "load failed");
    } finally {
      setReady(true);
    }
  }, [period]);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      navigate("/login");
      return;
    }
    void load();
  }, [load, navigate]);

  const visible = entries.filter((e) =>
    kind === "all" ? true : kind === "income" ? e.is_income : !e.is_income,
  );
  const maxTotal = Math.max(1, ...(breakdown?.breakdown.map((b) => b.total) ?? [1]));

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <img src={logoUrl} alt="" className="h-10 w-10 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Top nav */}
      <nav className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate("/dashboard")} aria-label="Dashboard">
              <img src={logoUrl} alt="Rafiq logo" className="h-7 w-7 rounded-lg" />
            </button>
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
                {user.username}
              </span>
              <button
                onClick={() => {
                  setSession(null, null);
                  setUser(null);
                  navigate("/login");
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

        {user && <TokensPanel />}

        <footer className="mt-12 border-t border-hairline pt-6 text-xs text-ink-tertiary">
          Rafiq · Tunis time (UTC+1) · refresh to sync changes made via chat
        </footer>
      </main>

      {editing && (
        <EditDialog entry={editing} onClose={() => setEditing(null)} onDone={load} />
      )}
    </div>
  );
}
