import { Bot, InlineKeyboard } from "grammy";
import { ctxForChat, linkChat, unlinkChat } from "./link.js";
import { HELP, cmdUndo, dispatch, parseCommand } from "./commands.js";
export function isTelegramConfigured() {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}
let bot = null;
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
export function getTelegramBot() {
    if (bot)
        return bot;
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
    bot.on("message:text", async (ctx) => {
        await ctx.reply(HELP);
    });
    return bot;
}
// Webhook entry: throws when unconfigured so web.ts can answer 503.
export async function handleTelegramUpdate(update) {
    const b = getTelegramBot();
    if (!b)
        throw Object.assign(new Error("telegram not configured"), { status: 503 });
    await b.handleUpdate(update);
}
//# sourceMappingURL=bot.js.map