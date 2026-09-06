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

  // Telegram: link chat → scoped ctx → commands → unlink.
  // (Handlers only — no Telegram network involved.)
  const { linkChat, ctxForChat, unlinkChat } = await import("../src/telegram/link.js");
  const { parseCommand, dispatch, cmdUndo } = await import("../src/telegram/commands.js");
  const tgToken = await createToken(owner.id, { name: "tg", scopes: [...SCOPES] });
  if (await ctxForChat(4242)) throw new Error("telegram: expected unlinked chat");
  await linkChat(4242, tgToken.token);
  const tgCtx = await ctxForChat(4242);
  if (!tgCtx) throw new Error("telegram: expected linked chat");
  const logged = await dispatch(tgCtx, "expense", "9.5 food tg-test");
  console.log("telegram log:", logged.text);
  if (!logged.undoId) throw new Error("telegram: expected undoId");
  const undone = await cmdUndo(tgCtx, logged.undoId);
  console.log("telegram undo:", undone.text);
  const parsed = parseCommand("/summary@rafiq_bot month");
  if (parsed.cmd !== "summary") throw new Error("telegram: @botname parse failed");
  console.log("telegram summary:", (await dispatch(tgCtx, parsed.cmd, parsed.argStr)).text);
  await expectFail(() => linkChat(4242, "rafiq_bogus"), "bad link token");
  await revokeToken(owner.id, tgToken.id);
  await expectFail(() => ctxForChat(4242), "revoked link token");
  await unlinkChat(4242);
  if (await ctxForChat(4242)) throw new Error("telegram: expected unlinked after /unlink");

  // LLM layer: pure logic + graceful degradation (no Ollama needed).
  const llm = await import("../src/telegram/llm.js");
  const pending = await import("../src/telegram/pending.js");
  const { executeIntent } = await import("../src/telegram/commands.js");
  const proposal = llm.formatProposal({ action: "log_expense", amount: 12.5, category: "food", note: "shawarma" });
  if (!proposal?.includes("12.50")) throw new Error("telegram: bad proposal format");
  if (llm.missingFields({ action: "log_expense", amount: null, category: null }).join() !== "amount,category") {
    throw new Error("telegram: bad missing-fields");
  }
  if (llm.scopeForAction("log_expense") !== "entries:create") throw new Error("telegram: bad scope map");
  if (!llm.needsConfirm("log_expense") || llm.needsConfirm("get_summary")) {
    throw new Error("telegram: bad confirm gating (reads instant, writes confirm)");
  }
  // qwen3:1.7b returns numbers as strings — schema must coerce.
  const coerced = llm.IntentSchema.parse({ action: "log_expense", amount: "12.5", category: "food", note: "shawarma", period: "month" });
  if (coerced.amount !== 12.5) throw new Error("telegram: numeric-string coercion failed");
  const pid = pending.savePending(4242, { action: "log_expense", amount: 2, category: "llm" });
  if (pending.takePending(pid, 9999)) throw new Error("telegram: pending leaked across chats");
  const pid2 = pending.savePending(4242, { action: "log_expense", amount: 2, category: "llm" }, 1);
  await new Promise((r) => setTimeout(r, 5));
  if (pending.takePending(pid2, 4242)) throw new Error("telegram: pending TTL ignored");
  const pid3 = pending.savePending(4242, { action: "log_expense", amount: 2, category: "llm" });
  const confirmed = pending.takePending(pid3, 4242);
  const viaIntent = await executeIntent(ownerCtx, confirmed);
  console.log("telegram intent:", viaIntent.text);
  if (!viaIntent.undoId) throw new Error("telegram: intent missing undoId");
  await deleteEntry({ id: viaIntent.undoId }, ownerCtx);
  process.env.OLLAMA_HOST = "http://127.0.0.1:1";
  process.env.OLLAMA_TIMEOUT_MS = "2000";
  await expectFail(() => llm.parseFreeText("hello", ownerCtx), "ollama down");
  delete process.env.OLLAMA_HOST;
  delete process.env.OLLAMA_TIMEOUT_MS;

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
