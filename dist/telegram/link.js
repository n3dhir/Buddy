import crypto from "node:crypto";
import { getDb } from "../db/client.js";
import { authForToken, ctxFor } from "../tools/users.js";
import { nowTunisDateTime } from "../tools/utils.js";
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
function linkDenied(msg, status = 400) {
    throw Object.assign(new Error(msg), { status });
}
// Link a Telegram chat to an account using a scoped API token
// (minted in the web UI — the chat inherits exactly its scopes).
// Returns the linked user id. Re-linking overwrites the previous link.
export async function linkChat(chatId, rawToken) {
    const token = String(rawToken ?? "").trim();
    if (!token)
        linkDenied("Send /start with your token: /start <token from the Tokens page>");
    let auth;
    try {
        auth = await authForToken(token);
    }
    catch {
        linkDenied("That token is invalid. Mint one in the web UI (Tokens page) and try again.");
    }
    const db = getDb();
    const chat = String(chatId);
    const stamp = nowTunisDateTime();
    const existing = await db("telegram_links").where({ telegram_chat_id: chat }).first();
    if (existing) {
        await db("telegram_links")
            .where({ telegram_chat_id: chat })
            .update({ user_id: auth.userId, token_hash: hashToken(token), updated_at: stamp });
    }
    else {
        await db("telegram_links").insert({
            telegram_chat_id: chat,
            user_id: auth.userId,
            token_hash: hashToken(token),
            created_at: stamp,
            updated_at: stamp,
        });
    }
    return { userId: auth.userId };
}
// Resolve a chat to its caller's scoped context.
// - null: chat never linked (or unlinked) → ask for /start <token>
// - throws "revoked": linked token was revoked/rotated → ask to re-link
export async function ctxForChat(chatId) {
    const db = getDb();
    const link = await db("telegram_links")
        .where({ telegram_chat_id: String(chatId) })
        .first();
    if (!link)
        return null;
    const tokenRow = await db("tokens").where({ token_hash: link.token_hash }).first();
    if (!tokenRow || tokenRow.user_id !== link.user_id) {
        linkDenied("Your linked token was revoked or changed. Link again: /start <new token>", 401);
    }
    return ctxFor(tokenRow.user_id, JSON.parse(tokenRow.scopes));
}
export async function unlinkChat(chatId) {
    const db = getDb();
    const deleted = await db("telegram_links")
        .where({ telegram_chat_id: String(chatId) })
        .del();
    return { unlinked: deleted > 0 };
}
//# sourceMappingURL=link.js.map