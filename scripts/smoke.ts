import { getDb, closeDb } from "../src/db/client.js";
import {
  deleteEntry,
  editEntry,
  getCategoryBreakdown,
  getSummary,
  listEntries,
  logExpense,
  logIncome,
} from "../src/tools/finance.js";

async function main() {
  process.env.RAFIQ_DB_PATH ??= ":memory:";
  const db = getDb();
  await db.migrate.latest();

  const e1 = await logExpense({ amount: 12.5, category: "food", note: "lunch", payment_method: "cash" });
  console.log("log_expense:", e1);

  const i1 = await logIncome({ amount: 2000, category: "salary", note: "aug" });
  console.log("log_income:", i1);

  console.log("list:", await listEntries({}));
  console.log("summary month:", await getSummary({ period: "month" }));
  console.log("breakdown month:", await getCategoryBreakdown({ period: "month" }));
  console.log("edit:", await editEntry({ id: e1.id, note: "lunch updated" }));
  console.log("delete:", await deleteEntry({ id: e1.id }));
  console.log("list after delete:", await listEntries({}));

  await closeDb();
  console.log("SMOKE OK");
}

main().catch(async (e) => {
  console.error("SMOKE FAIL:", e);
  try {
    await closeDb();
  } catch { /* ignore */ }
  process.exit(1);
});
