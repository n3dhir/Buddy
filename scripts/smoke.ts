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
  authForToken,
  createToken,
  ctxFor,
  register,
  revokeToken,
  SCOPES,
  updateToken,
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

  // Tokens: users are equal, data is scoped, tokens carry chosen scopes.
  const owner = await register({ username: "owner", password: "password123" });
  const sam = await register({ username: "sam", password: "password123" });
  console.log("registered:", owner.username, "+", sam.username);
  await expectFail(
    () => register({ username: "owner", password: "password123" }),
    "duplicate username",
  );
  await expectFail(
    () => authenticate({ username: "sam", password: "wrongpass1" }),
    "bad password",
  );
  const ownerToken = await createToken(owner.id, { name: "all", scopes: [...SCOPES] });
  const readToken = await createToken(sam.id, { name: "ro", scopes: ["entries:read"] });
  console.log("token prefix:", ownerToken.token.slice(0, 10));
  const ownerCtx = await authForToken(ownerToken.token);
  const roCtx = await authForToken(readToken.token);
  const mine = await logExpense({ amount: 5, category: "mine" }, ownerCtx);
  await expectFail(() => logExpense({ amount: 1, category: "x" }, roCtx), "read-only create");
  await expectFail(() => deleteEntry({ id: mine.id }, roCtx), "read-only delete");
  console.log("read-only list:", (await listEntries({}, roCtx)).length, "row(s)");
  console.log("sam (no rows) sees:", (await listEntries({}, ctxFor(sam.id, ["entries:read"]))).length);
  await expectFail(() => editEntry({ id: mine.id, note: "hijack" }, roCtx), "cross-user edit");
  await revokeToken(sam.id, readToken.id);
  await expectFail(() => authForToken(readToken.token), "revoked token");
  const flex = await createToken(owner.id, { name: "flex", scopes: [...SCOPES] });
  const flexCtx = await authForToken(flex.token);
  await logExpense({ amount: 1, category: "flex" }, flexCtx);
  await updateToken(owner.id, flex.id, { scopes: ["entries:read"] });
  const narrowed = await authForToken(flex.token);
  await expectFail(() => logExpense({ amount: 1, category: "x" }, narrowed), "narrowed create");
  console.log("narrowed list:", (await listEntries({}, narrowed)).length, "row(s)");
  await expectFail(() => updateToken(owner.id, 9999, { scopes: ["entries:read"] }), "update missing token");
  await deleteEntry({ id: mine.id }, ownerCtx);

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
