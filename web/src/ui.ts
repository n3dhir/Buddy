import type { Summary } from "./api";

export const input =
  "w-full rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-brand-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-brand/50";
export const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-hover active:brightness-95";
export const btnSecondary =
  "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-hairline bg-surface-1 px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-2";
export const btnGhost =
  "inline-flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm text-ink-subtle hover:bg-surface-2 hover:text-ink";
export const card = "edge rounded-xl border border-hairline bg-surface-1";
export const eyebrow = "text-[13px] font-medium tracking-[0.4px] text-ink-subtle";

export function money(n: number) {
  return n.toFixed(2);
}

export function greeting(): string {
  const h = new Date(Date.now() + 3_600_000).getUTCHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function periodTitle(s: Summary | null): string {
  if (!s) return "Overview";
  if (s.period === "week") return "Last 7 days";
  if (s.period === "year") return s.to.slice(0, 4);
  return new Date(`${s.to}T00:00:00`).toLocaleString("en", { month: "long" });
}
