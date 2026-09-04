export type Period = "week" | "month" | "year";

export interface TransactionRow {
  id: number;
  amount: number;
  currency: string;
  category: string;
  note: string | null;
  payment_method: string | null;
  date: string;
  is_income: boolean | number;
  created_at: string;
  updated_at: string;
}

// Tunisia is UTC+1 year-round (no DST).
const tunisNow = () => new Date(Date.now() + 3_600_000);

export const todayISO = () => tunisNow().toISOString().slice(0, 10);

export const nowTunisDateTime = () =>
  tunisNow().toISOString().slice(0, 19).replace("T", " ");

export const isValidDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export const normCat = (s: string) => s.trim().toLowerCase();

export function resolvePeriod(period: Period) {
  const now = tunisNow();
  const to = now.toISOString().slice(0, 10);
  if (period === "week")
    return {
      from: new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10),
      to,
    };
  if (period === "month") return { from: `${to.slice(0, 7)}-01`, to };
  return { from: `${to.slice(0, 4)}-01-01`, to };
}

export function normalizeRow(row: TransactionRow) {
  return {
    ...row,
    amount: Number(row.amount),
    is_income: Boolean(row.is_income),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
