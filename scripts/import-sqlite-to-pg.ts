import Database from "better-sqlite3";
import path from "node:path";
import { getDb, closeDb } from "../src/db/client.js";

// One-off: copy rows from legacy rafiq.db (SQLite) into Postgres.
// Preserves ids; treats stored wall timestamps as Tunis time.
// Usage: SQLITE_PATH=./rafiq.db DATABASE_URL=... npx tsx scripts/import-sqlite-to-pg.ts

// Tunis wall "YYYY-MM-DD HH:MM:SS" -> UTC instant (Tunis is fixed UTC+1).
const toInstant = (s: string) =>
  new Date(`${s.replace(" ", "T")}+01:00`).toISOString();

async function main() {
  const sqlitePath =
    process.env.SQLITE_PATH ??
    path.join(process.cwd(), "rafiq.db");
  const src = new Database(sqlitePath, { readonly: true });
  const rows = src
    .prepare("SELECT * FROM transactions ORDER BY id")
    .all() as Record<string, unknown>[];
  console.log(`source rows: ${rows.length}`);

  const db = getDb();
  for (const r of rows) {
    await db("transactions")
      .insert({
        id: r.id as number,
        amount: r.amount as number,
        currency: r.currency as string,
        category: r.category as string,
        note: (r.note as string | null) ?? null,
        payment_method: (r.payment_method as string | null) ?? null,
        date: r.date as string,
        is_income: Boolean(r.is_income),
        created_at: toInstant(r.created_at as string),
        updated_at: toInstant(r.updated_at as string),
      })
      .onConflict("id")
      .ignore();
  }
  const max = await db("transactions").max({ m: "id" }).first();
  if (max?.m) {
    await db.raw(
      `SELECT setval(pg_get_serial_sequence('transactions', 'id'), ?)`,
      [max.m as number],
    );
  }
  const count = await db("transactions").count({ c: "id" }).first();
  console.log(`target rows: ${count?.c}`);
  src.close();
  await closeDb();
  console.log("IMPORT OK");
}

main().catch(async (e) => {
  console.error("IMPORT FAIL:", e);
  try {
    await closeDb();
  } catch { /* ignore */ }
  process.exit(1);
});
