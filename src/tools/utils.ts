// Africa/Tunis — never a fixed offset: stays correct even if DST rules change.
// (Europe/Paris looks the same in winter but is UTC+2 in summer — wrong zone.)
const TZ = "Africa/Tunis";
const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dtFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export const toTunisDate = (d) => dateFmt.format(d);

export const toTunisDateTime = (d) => {
  const p: any = {};
  for (const { type, value } of dtFmt.formatToParts(d)) p[type] = value;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

export const todayISO = () => toTunisDate(new Date());

export const nowTunisDateTime = () => toTunisDateTime(new Date());

export const isValidDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export const normCat = (s) => s.trim().toLowerCase();

export function resolvePeriod(period) {
  const to = todayISO();
  if (period === "week") {
    const [y, m, d] = to.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, d) - 6 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { from, to };
  }
  if (period === "month") return { from: `${to.slice(0, 7)}-01`, to };
  return { from: `${to.slice(0, 4)}-01-01`, to };
}

// Drivers return DB-native types (numbers as strings, Dates, 0/1).
// This coerces rows into clean JSON types.
export function normalizeRow(row) {
  return {
    ...row,
    amount: Number(row.amount),
    is_income: Boolean(row.is_income),
    date: row.date instanceof Date ? toTunisDate(row.date) : row.date,
    created_at: stamp(row.created_at),
    updated_at: stamp(row.updated_at),
  };
}

function stamp(v) {
  return v instanceof Date ? toTunisDateTime(v) : v;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
