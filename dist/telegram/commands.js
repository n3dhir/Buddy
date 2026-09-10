import { deleteEntry, getCategoryBreakdown, getSummary, listEntries, logExpense, logIncome, } from "../tools/finance.js";
export const HELP = [
    "Buddy bot commands:",
    "/expense <amount> <category> [note] — log spending",
    "/income <amount> <category> [note] — log income",
    "/summary <week|month|year> [category] — totals",
    "/breakdown <week|month|year> — spending by category",
    "/list [category] [limit] — recent entries",
    "/delete <id> — delete an entry",
    "/unlink — forget this chat's link",
    "/help — this message",
    "",
    "Or just type naturally (e.g. “shawarma 12.5”) — I'll confirm before logging anything.",
].join("\n");
const USAGE = {
    expense: "Usage: /expense <amount> <category> [note…]  (e.g. /expense 12.5 food shawarma)",
    income: "Usage: /income <amount> <category> [note…]  (e.g. /income 2000 salary august)",
    summary: "Usage: /summary <week|month|year> [category]",
    breakdown: "Usage: /breakdown <week|month|year>",
    list: "Usage: /list [category] [limit]  (e.g. /list food 10)",
    delete: "Usage: /delete <id>  (e.g. /delete 12)",
};
function fail(msg, status = 400) {
    throw Object.assign(new Error(msg), { status });
}
// Split "/cmd args" (or "cmd args") into { cmd, argStr }.
// Handles the "/cmd@botname args" form Telegram sends in groups.
export function parseCommand(text) {
    const t = String(text ?? "").trim();
    if (!t)
        fail("Empty message. " + HELP);
    const m = t.match(/^\/?([a-zA-Z_]+)(?:@\w+)?\s*(.*)$/s);
    if (!m)
        fail("I only understand commands. " + HELP);
    return { cmd: m[1].toLowerCase(), argStr: (m[2] ?? "").trim() };
}
function parseAmount(raw) {
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0)
        fail("Amount must be a positive number.");
    return Math.round(n * 100) / 100;
}
function parseEntryArgs(argStr, usage) {
    const parts = argStr.split(/\s+/).filter(Boolean);
    if (parts.length < 2)
        fail(usage);
    const [amountRaw, category, ...noteParts] = parts;
    return { amount: parseAmount(amountRaw), category, note: noteParts.join(" ") || undefined };
}
function parsePeriod(argStr, usage) {
    const p = argStr.split(/\s+/).filter(Boolean)[0];
    if (p !== "week" && p !== "month" && p !== "year")
        fail(usage);
    return p;
}
const money = (amount, currency) => `${Number(amount).toFixed(2)} ${currency ?? "TND"}`;
function entryLine(e) {
    const note = e.note ? ` · ${e.note}` : "";
    return `#${e.id} ${money(e.amount, e.currency)} ${e.category}${note}`;
}
// Each handler takes the caller's scoped ctx and returns
// { text, undoId? } — undoId wires the [Undo] button in bot.ts.
export async function cmdExpense(ctx, argStr) {
    const { amount, category, note } = parseEntryArgs(argStr, USAGE.expense);
    const e = await logExpense({ amount, category, note }, ctx);
    return {
        text: `✅ Expense ${entryLine(e)}`,
        undoId: e.id,
    };
}
export async function cmdIncome(ctx, argStr) {
    const { amount, category, note } = parseEntryArgs(argStr, USAGE.income);
    const e = await logIncome({ amount, category, note }, ctx);
    return {
        text: `✅ Income ${entryLine(e)}`,
        undoId: e.id,
    };
}
export async function cmdSummary(ctx, argStr) {
    const parts = argStr.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        fail(USAGE.summary);
    const period = parsePeriod(parts[0], USAGE.summary);
    const s = await getSummary({ period, category: parts[1] }, ctx);
    const scope = parts[1] ? ` · ${parts[1]}` : "";
    return {
        text: `${period} (${s.from} → ${s.to})${scope}:\n` +
            `spent ${money(s.total_spent, "TND")} · income ${money(s.total_income, "TND")} · net ${money(s.net, "TND")} · ${s.count} entries`,
    };
}
export async function cmdBreakdown(ctx, argStr) {
    const period = parsePeriod(argStr, USAGE.breakdown);
    const b = await getCategoryBreakdown({ period }, ctx);
    if (b.breakdown.length === 0)
        return { text: `No spending in ${period} (${b.from} → ${b.to}).` };
    const lines = b.breakdown.map((r) => `${r.category} — ${Number(r.total).toFixed(2)} (${r.count})`);
    return { text: `${period} spending (${b.from} → ${b.to}):\n` + lines.join("\n") };
}
export async function cmdList(ctx, argStr) {
    const parts = argStr.split(/\s+/).filter(Boolean);
    let category;
    let limit;
    for (const p of parts) {
        if (/^\d+$/.test(p))
            limit = Math.min(Number(p), 200);
        else if (category === undefined)
            category = p;
        else
            fail(USAGE.list);
    }
    const rows = await listEntries({ category, limit: limit ?? 10 }, ctx);
    if (rows.length === 0)
        return { text: "No entries found." };
    return { text: rows.map(entryLine).join("\n") };
}
export async function cmdDelete(ctx, argStr) {
    const id = Number(argStr.trim());
    if (!Number.isInteger(id) || id <= 0)
        fail(USAGE.delete);
    await deleteEntry({ id }, ctx);
    return { text: `🗑️ Deleted entry #${id}.` };
}
// Undo a just-logged entry. Requires entries:delete on the linked token.
export async function cmdUndo(ctx, entryId) {
    const id = Number(entryId);
    if (!Number.isInteger(id) || id <= 0)
        fail("Nothing to undo.");
    const rows = await listEntries({ limit: 200 }, ctx);
    const target = rows.find((r) => r.id === id);
    await deleteEntry({ id }, ctx);
    const what = target ? ` (${money(target.amount, target.currency)} · ${target.category})` : "";
    return { text: `↩️ Undone entry #${id}${what}.` };
}
// Execute an LLM-parsed intent by reusing the command handlers
// (same validation, same scope checks, same undo wiring).
export async function executeIntent(ctx, intent) {
    const note = intent.note ? ` ${intent.note}` : "";
    switch (intent.action) {
        case "log_expense":
            return cmdExpense(ctx, `${intent.amount} ${intent.category}${note}`);
        case "log_income":
            return cmdIncome(ctx, `${intent.amount} ${intent.category}${note}`);
        case "get_summary":
            return cmdSummary(ctx, `${intent.period ?? ""} ${intent.category ?? ""}`.trim());
        case "get_category_breakdown":
            return cmdBreakdown(ctx, intent.period ?? "");
        case "list_entries":
            return cmdList(ctx, `${intent.category ?? ""} ${intent.limit ?? ""}`.trim());
        case "delete_entry":
            return cmdDelete(ctx, String(intent.entry_id ?? ""));
        default:
            fail("I can't do that yet — try /help for commands.");
    }
}
export async function dispatch(ctx, cmd, argStr) {
    switch (cmd) {
        case "expense":
            return cmdExpense(ctx, argStr);
        case "income":
            return cmdIncome(ctx, argStr);
        case "summary":
            return cmdSummary(ctx, argStr);
        case "breakdown":
            return cmdBreakdown(ctx, argStr);
        case "list":
            return cmdList(ctx, argStr);
        case "delete":
            return cmdDelete(ctx, argStr);
        case "help":
            return { text: HELP };
        default:
            fail(`Unknown command /${cmd}.\n\n` + HELP);
    }
}
//# sourceMappingURL=commands.js.map