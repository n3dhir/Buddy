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
import {
  authenticate,
  ctxFor,
  listUsers,
  permsFor,
  register,
  setRole,
} from "../src/tools/users.js";

async function expectFail(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch (e) {
    console.log(`${label}: denied (${e instanceof Error ? e.message : e})`);
    return;
  }
  throw new Error(`${label}: expected denial, got success`);
}

async function main() {
  process.env.DB_CLIENT ??= "sqlite";
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

  // RBAC: first registrant is admin, rest are users, rows are scoped.
  const admin = await register({ username: "owner", password: "password123" });
  console.log("first register role:", admin.role);
  const member = await register({ username: "sam", password: "password123" });
  console.log("second register role:", member.role);
  await expectFail(
    () => register({ username: "owner", password: "password123" }),
    "duplicate username",
  );
  await expectFail(
    () => authenticate({ username: "sam", password: "wrongpass1" }),
    "bad password",
  );
  const adminCtx = ctxFor(admin.id, "admin", (await permsFor(admin.id)).perms);
  const userCtx = ctxFor(member.id, "user", (await permsFor(member.id)).perms);
  const mine = await logExpense({ amount: 5, category: "mine" }, userCtx);
  console.log("user sees own rows:", (await listEntries({}, userCtx)).length);
  console.log("admin sees all rows:", (await listEntries({}, adminCtx)).length);
  await expectFail(() => editEntry({ id: i1.id, note: "hijack" }, userCtx), "cross-user edit");
  await expectFail(() => deleteEntry({ id: i1.id }, userCtx), "cross-user delete");
  await expectFail(() => listUsers(userCtx), "non-admin listUsers");
  await expectFail(() => setRole({ id: member.id, role: "admin" }, userCtx), "non-admin setRole");
  console.log("users (admin):", await listUsers(adminCtx));
  console.log("promote:", await setRole({ id: member.id, role: "admin" }, adminCtx));
  process.env.ALLOW_REGISTER = "false";
  await expectFail(() => register({ username: "zed", password: "password123" }), "closed registration");
  await deleteEntry({ id: mine.id }, userCtx);

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
