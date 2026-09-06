import { z } from "zod";
import { listEntries } from "../tools/finance.js";
import { PERMS } from "../tools/users.js";
import { todayISO } from "../tools/utils.js";

// Free-text parsing via Ollama (default qwen3:1.7b). The LLM only
// *proposes*: output is validated here, the user confirms in chat,
// and deterministic code in commands.ts executes. The model never
// touches the database.
//
// qwen3 specifics: disable thinking (options.think=false) or the
// <think> block corrupts JSON; format:"json" constrains Ollama to
// valid JSON. Anything unparseable degrades to {action:"unknown"}
// (safe direction: user falls back to commands).

// Small models return numbers as strings ("12.5"). Coerce those;
// anything truly non-numeric still fails validation -> unknown.
const numField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v),
  z.number().nullable().optional(),
);

const cleanStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().nullable().optional(),
);

export const IntentSchema = z.object({
  action: z.enum([
    "log_expense",
    "log_income",
    "get_summary",
    "get_category_breakdown",
    "list_entries",
    "delete_entry",
    "unknown",
  ]),
  amount: numField,
  category: cleanStr,
  note: cleanStr,
  period: z.enum(["week", "month", "year"]).nullable().optional(),
  entry_id: numField,
  limit: numField,
});

export type Intent = z.infer<typeof IntentSchema>;

export class LLMUnavailable extends Error {}

function cfg() {
  return {
    host: process.env.OLLAMA_HOST ?? "http://localhost:11434",
    model: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 30000),
  };
}

function systemPrompt(categories) {
  const known = categories.length > 0 ? categories.join(", ") : "(none yet — accept the user's words)";
  return [
    "You parse personal-finance requests into strict JSON. No prose, JSON only.",
    'Schema: {"action": "log_expense"|"log_income"|"get_summary"|"get_category_breakdown"|"list_entries"|"delete_entry"|"unknown", "amount": number|null, "category": string|null, "note": string|null, "period": "week"|"month"|"year"|null, "entry_id": number|null, "limit": number|null}',
    "Rules:",
    `- Known categories: ${known}. Map obvious synonyms onto them (dinner/lunch/shawarma -> food); otherwise keep the user's word.`,
    '- Amounts may use a comma decimal ("3,5" = 3.5). A log with missing or non-positive amount is "unknown".',
    '- "how much / spent / total" -> get_summary (period required; "this week" = week; no period = null).',
    '- "by category / breakdown" -> get_category_breakdown.',
    '- "show / list / recent" -> list_entries.',
    '- "delete / remove / undo #N" -> delete_entry with entry_id.',
    "- Anything unmappable -> action unknown with all nulls. Never invent numbers.",
    `Today is ${todayISO()} (Africa/Tunis).`,
  ].join("\n");
}

async function knownCategories(ctx) {
  try {
    const rows = await listEntries({ limit: 200 }, ctx);
    return [...new Set(rows.map((r) => r.category))].slice(0, 50);
  } catch {
    return [];
  }
}

function stripThink(s) {
  return String(s ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// Returns a validated intent. {action:"unknown"} on model confusion;
// throws LLMUnavailable when Ollama can't be reached in time.
export async function parseFreeText(text, ctx): Promise<Intent> {
  const { host, model, timeoutMs } = cfg();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        // think:false unless OLLAMA_THINK=1 (debugging). Qwen3's
        // thinking trace would otherwise eat the token budget and
        // leave content empty. Top-level (not options) is what this
        // Ollama version honors.
        think: process.env.OLLAMA_THINK === "1",
        options: {
          temperature: 0,
          num_predict: 200,
        },
        messages: [
          { role: "system", content: systemPrompt(await knownCategories(ctx)) },
          { role: "user", content: String(text).slice(0, 500) },
        ],
      }),
    });
  } catch (e) {
    throw new LLMUnavailable(`Ollama unreachable at ${host} (${e instanceof Error ? e.message : e})`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new LLMUnavailable(`Ollama HTTP ${res.status} at ${host}`);
  let data;
  try {
    data = await res.json();
  } catch {
    return { action: "unknown" };
  }
  try {
    return IntentSchema.parse(JSON.parse(stripThink(data?.message?.content)));
  } catch {
    return { action: "unknown" };
  }
}

// Action -> required scope for the up-front check (no confirm theater
// when the token can't execute anyway).
export function scopeForAction(action) {
  switch (action) {
    case "log_expense":
    case "log_income":
      return PERMS.create;
    case "get_summary":
    case "get_category_breakdown":
    case "list_entries":
      return PERMS.read;
    case "delete_entry":
      return PERMS.delete;
    default:
      return null;
  }
}

// What's missing before an intent is executable (for the "almost" reply).
export function missingFields(intent: Intent): string[] {
  const missing: string[] = [];
  switch (intent.action) {
    case "log_expense":
    case "log_income":
      if (!(intent.amount > 0)) missing.push("amount");
      if (!intent.category) missing.push("category");
      break;
    case "get_summary":
    case "get_category_breakdown":
      if (!intent.period) missing.push("period (week/month/year)");
      break;
    case "delete_entry":
      if (!intent.entry_id) missing.push("entry id (#N)");
      break;
    default:
      break;
  }
  return missing;
}

// One-line human proposal for the confirm button message.
export function formatProposal(intent: Intent) {
  const note = intent.note ? ` · "${intent.note}"` : "";
  switch (intent.action) {
    case "log_expense":
      return `Log expense: ${Number(intent.amount).toFixed(2)} ${intent.category}${note}?`;
    case "log_income":
      return `Log income: ${Number(intent.amount).toFixed(2)} ${intent.category}${note}?`;
    case "get_summary":
      return `Show ${intent.period} summary${intent.category ? ` for ${intent.category}` : ""}?`;
    case "get_category_breakdown":
      return `Show ${intent.period} breakdown?`;
    case "list_entries":
      return `List entries${intent.category ? ` in ${intent.category}` : ""}${intent.limit ? ` (up to ${intent.limit})` : ""}?`;
    case "delete_entry":
      return `Delete entry #${intent.entry_id}?`;
    default:
      return null;
  }
}
