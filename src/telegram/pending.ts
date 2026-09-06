import crypto from "node:crypto";

// Awaiting-confirmation intents: chat -> parsed proposal.
// In-memory (single process): a restart drops them and the user
// just retypes. TTL 5 min; consumed single-use on confirm/cancel.
const store = new Map();

export function savePending(chatId, intent, ttlMs = 5 * 60 * 1000) {
  if (store.size > 500) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  const id = crypto.randomBytes(4).toString("hex");
  store.set(id, { chatId: String(chatId), intent, expires: Date.now() + ttlMs });
  return id;
}

// Returns the intent only if it exists, belongs to this chat, and
// hasn't expired. Always consumes (single-use).
export function takePending(id, chatId) {
  const p = store.get(String(id));
  store.delete(String(id));
  if (!p || p.chatId !== String(chatId) || p.expires < Date.now()) return null;
  return p.intent;
}

export function pendingCount() {
  return store.size;
}
