import { Bot, InlineKeyboard } from "grammy";
import { ctxForChat, linkChat, unlinkChat } from "./link.js";
import { HELP, cmdUndo, dispatch, executeIntent, parseCommand } from "./commands.js";
import { formatProposal, LLMUnavailable, missingFields, needsConfirm, parseFreeText, scopeForAction } from "./llm.js";
import { savePending, takePending } from "./pending.js";
export function isTelegramConfigured() {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}
let bot = null;
let initPromise = null;
function undoKeyboard(entryId) {
    return new InlineKeyboard().text("↩️ Undo", `undo:${entryId}`);
}
function errText(e) {
    {
        const status = e?.status;
        const message = e instanceof Error ? e.message : String(e);
        if (typeof status === "number" && status === 403 && /needs /.test(message)) {
            return `⛔ ${message}. Mint a token with that scope (Tokens page) and /start again.`;
        }
        return `⚠️ ${message}`;
    }
    return "⚠️ Something went wrong.";
}
export async function getTelegramBot() {
    if (bot) {
        await initPromise;
        return bot;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token)
        return null;
    bot = new Bot(token);
    bot.catch((err) => console.error("telegram bot error:", err.error));
    bot.command("start", async (ctx) => {
        const arg = ctx.match.trim();
        if (!arg) {
            await ctx.reply("Welcome to Rafiq 👋\nLink this chat first: /start <token>\nMint the token in the web UI (Tokens page) — the chat gets exactly that token's scopes.");
            return;
        }
        try {
            await linkChat(ctx.chat.id, arg);
            await ctx.reply("✅ Linked! Try /summary month or log one: /expense 12.5 food shawarma");
        }
        catch (e) {
            await ctx.reply(errText(e));
        }
    });
    bot.command("unlink", async (ctx) => {
        const { unlinked } = await unlinkChat(ctx.chat.id);
        await ctx.reply(unlinked ? "🔌 Unlinked. /start <token> to link again." : "Nothing to unlink — this chat isn't linked.");
    });
    bot.command(["expense", "income", "summary", "breakdown", "list", "delete", "help"], async (ctx) => {
        const auth = await ctxForChat(ctx.chat.id);
        if (!auth) {
            await ctx.reply("🔗 Link this chat first: /start <token from the Tokens page>");
            return;
        }
        const raw = ctx.message?.text ?? "";
        let cmd = "";
        let argStr = "";
        try {
            ({ cmd, argStr } = parseCommand(raw));
        }
        catch (e) {
            await ctx.reply(errText(e));
            return;
        }
        try {
            const reply = await dispatch(auth, cmd, argStr);
            if (reply.undoId) {
                await ctx.reply(reply.text, { reply_markup: undoKeyboard(reply.undoId) });
            }
            else {
                await ctx.reply(reply.text);
            }
        }
        catch (e) {
            await ctx.reply(errText(e));
        }
    });
    bot.callbackQuery(/^undo:(\d+)$/, async (ctx) => {
        const auth = await ctxForChat(ctx.chat.id);
        if (!auth) {
            await ctx.answerCallbackQuery({ text: "Chat isn't linked. /start again.", show_alert: true });
            return;
        }
        try {
            const reply = await cmdUndo(auth, ctx.match[1]);
            await ctx.editMessageText(reply.text);
        }
        catch (e) {
            await ctx.answerCallbackQuery({ text: e instanceof Error ? e.message : "Undo failed.", show_alert: true });
        }
    });
    bot.callbackQuery(/^lc:([0-9a-f]+)$/, async (ctx) => {
        const intent = takePending(ctx.match[1], ctx.chat.id);
        if (!intent) {
            await ctx.answerCallbackQuery({ text: "Expired — send it again.", show_alert: true });
            return;
        }
        const auth = await ctxForChat(ctx.chat.id);
        if (!auth) {
            await ctx.editMessageText("🔗 Link this chat first: /start <token from the Tokens page>");
            return;
        }
        try {
            const reply = await executeIntent(auth, intent);
            if (reply.undoId) {
                await ctx.editMessageText(reply.text, { reply_markup: undoKeyboard(reply.undoId) });
            }
            else {
                await ctx.editMessageText(reply.text);
            }
        }
        catch (e) {
            await ctx.editMessageText(errText(e));
        }
    });
    bot.callbackQuery(/^lx:([0-9a-f]+)$/, async (ctx) => {
        const intent = takePending(ctx.match[1], ctx.chat.id);
        await ctx.editMessageText(intent ? "❌ Cancelled — nothing logged." : "Already expired.");
    });
    // NOTE: grammy runs every matching handler, so commands handled
    // above would ALSO land here — the "/" guard stops double replies.
    bot.on("message:text", async (ctx) => {
        const text = ctx.message?.text ?? "";
        if (text.trim().startsWith("/"))
            return;
        const auth = await ctxForChat(ctx.chat.id);
        if (!auth) {
            await ctx.reply("🔗 Link this chat first: /start <token from the Tokens page>");
            return;
        }
        let intent;
        try {
            await ctx.replyWithChatAction("typing");
            intent = await parseFreeText(text, auth);
        }
        catch (e) {
            if (e instanceof LLMUnavailable) {
                await ctx.reply("🧠 My parser is offline right now — use commands instead:\n\n" + HELP);
            }
            else {
                await ctx.reply(errText(e));
            }
            return;
        }
        if (intent.action === "unknown") {
            await ctx.reply("🤷 I didn't get that. Try:\n" + HELP);
            return;
        }
        const missing = missingFields(intent);
        if (missing.length > 0) {
            await ctx.reply(`Almost — I need: ${missing.join(" + ")}.\nExample: “shawarma 12.5”.`);
            return;
        }
        const scope = scopeForAction(intent.action);
        if (scope && !auth.can(scope)) {
            await ctx.reply(`⛔ I understood (${intent.action}), but your token lacks ${scope}. Mint a wider token (Tokens page) and /start again.`);
            return;
        }
        // Reads are harmless: answer right away. Writes go through Confirm.
        if (!needsConfirm(intent.action)) {
            try {
                const reply = await executeIntent(auth, intent);
                await ctx.reply(reply.text);
            }
            catch (e) {
                await ctx.reply(errText(e));
            }
            return;
        }
        const proposal = formatProposal(intent);
        if (!proposal) {
            await ctx.reply("🤷 I can't do that yet — try /help for commands.");
            return;
        }
        const id = savePending(ctx.chat.id, intent);
        const kb = new InlineKeyboard().text("✅ Confirm", `lc:${id}`).text("❌ Cancel", `lx:${id}`);
        await ctx.reply(proposal, { reply_markup: kb });
    });
    // Webhook-only mode never calls bot.start(), so fetch bot info
    // (getMe) explicitly — otherwise the first handleUpdate throws
    // "Bot not initialized!". Cached: concurrent updates share it,
    // and a failure resets so the next update retries.
    if (!initPromise) {
        initPromise = bot.init().catch((e) => {
            bot = null;
            initPromise = null;
            throw e;
        });
    }
    await initPromise;
    return bot;
}
// Webhook entry: throws when unconfigured so web.ts can answer 503.
export async function handleTelegramUpdate(update) {
    const b = await getTelegramBot();
    if (!b)
        throw Object.assign(new Error("telegram not configured"), { status: 503 });
    await b.handleUpdate(update);
}
//# sourceMappingURL=bot.js.map