export type Period = "week" | "month" | "year";

export interface TransactionRow {
  id: number;
  amount: number;
  currency: string;
  category: string;
  note: string | null;
  payment_method: string | null;
  date: string | Date;
  is_income: boolean | number;
  created_at: string | Date;
  updated_at: string | Date;
}

// Tunisia is UTC+1 year-round (no DST).
const shift = (d: Date) => new Date(d.getTime() + 3_600_000);

export const toTunisDate = (d: Date) => shift(d).toISOString().slice(0, 10);

export const toTunisDateTime = (d: Date) =>
  shift(d).toISOString().slice(0, 19).replace("T", " ");

export const todayISO = () => toTunisDate(new Date());

export const nowTunisDateTime = () => toTunisDateTime(new Date());

export const isValidDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export const normCat = (s: string) => s.trim().toLowerCase();

export function resolvePeriod(period: Period) {
  const now = shift(new Date());
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
  const stamp = (v: string | Date) =>
    v instanceof Date ? toTunisDateTime(v) : v;
  return {
    ...row,
    amount: Number(row.amount),
    is_income: Boolean(row.is_income),
    date: row.date instanceof Date ? toTunisDate(row.date) : row.date,
    created_at: stamp(row.created_at),
    updated_at: stamp(row.updated_at),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
