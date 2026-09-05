import { z } from "zod";
import { getDb } from "../db/client.js";
import {
  isValidDate,
  normCat,
  normalizeRow,
  nowTunisDateTime,
  resolvePeriod,
  round2,
  todayISO,
  type TransactionRow,
} from "./utils.js";
import { need, PERMS, SYS_CTX, type AuthCtx } from "./users.js";

// Rows are scoped to the caller: admins see everything, users see their own.
// SYS_CTX (local stdio, tests) bypasses scoping.
function scope<T>(q: T, ctx: AuthCtx): T {
  if (!ctx.isAdmin) {
    (q as { andWhere: (c: object) => void }).andWhere({ user_id: ctx.userId });
  }
  return q;
}

// ---------- shared ----------

export const PeriodSchema = z.enum(["week", "month", "year"]);

export const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// ---------- log_expense / log_income ----------

export const LogEntrySchema = z.object({
  amount: z.number().positive().describe("Amount, e.g. 12.5"),
  category: z.string().min(1).describe("Category, e.g. food, transport, salary"),
  note: z.string().optional().describe("Optional free-text note"),
  date: DateString.optional().describe("YYYY-MM-DD, defaults to today (Tunis time)"),
  payment_method: z.string().optional().describe("Free-form, e.g. cash, card, bank transfer"),
  currency: z.string().length(3).optional().describe("3-letter code, defaults to TND"),
});

async function insertEntry(
  input: z.infer<typeof LogEntrySchema> & { is_income: boolean },
  ctx: AuthCtx = SYS_CTX,
) {
  need(ctx, PERMS.create);
  const db = getDb();
  const date = input.date ?? todayISO();
  if (!isValidDate(date)) throw new Error(`Invalid date: ${date}`);
  const inserted = await db("transactions").insert({
    amount: round2(input.amount),
    category: normCat(input.category),
    note: input.note ?? null,
    payment_method: input.payment_method ?? null,
    date,
    currency: (input.currency ?? "TND").toUpperCase(),
    is_income: input.is_income,
    user_id: ctx.userId,
    created_at: nowTunisDateTime(),
    updated_at: nowTunisDateTime(),
  }).returning("id");
  const rowId =
    typeof inserted[0] === "object"
      ? (inserted[0] as { id: number }).id
      : (inserted[0] as number);
  const row = await db("transactions").where({ id: rowId }).first();
  return normalizeRow(row as TransactionRow);
}

export async function logExpense(input: z.infer<typeof LogEntrySchema>, ctx: AuthCtx = SYS_CTX) {
  return insertEntry({ ...input, is_income: false }, ctx);
}

export async function logIncome(input: z.infer<typeof LogEntrySchema>, ctx: AuthCtx = SYS_CTX) {
  return insertEntry({ ...input, is_income: true }, ctx);
}

// ---------- get_summary ----------

export const GetSummarySchema = z.object({
  period: PeriodSchema.describe("week = last 7 days, month/year = calendar"),
  category: z.string().optional().describe("Optional category filter"),
});

export async function getSummary(input: z.infer<typeof GetSummarySchema>, ctx: AuthCtx = SYS_CTX) {
  need(ctx, PERMS.read);
  const { from, to } = resolvePeriod(input.period);
  const db = getDb();
  const q = scope(db("transactions").whereBetween("date", [from, to]), ctx);
  if (input.category) q.andWhere({ category: normCat(input.category) });
  const rows = (await q.select()) as TransactionRow[];
  let income = 0;
  let spent = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.is_income) income += amt;
    else spent += amt;
  }
  return {
    period: input.period,
    from,
    to,
    category: input.category ?? null,
    count: rows.length,
    total_income: round2(income),
    total_spent: round2(spent),
    net: round2(income - spent),
    currency: "mixed (filter by currency in list_entries if needed)",
  };
}

// ---------- get_category_breakdown ----------

export const CategoryBreakdownSchema = z.object({
  period: PeriodSchema.describe("week = last 7 days, month/year = calendar"),
});

export async function getCategoryBreakdown(
  input: z.infer<typeof CategoryBreakdownSchema>,
  ctx: AuthCtx = SYS_CTX,
) {
  need(ctx, PERMS.read);
  const { from, to } = resolvePeriod(input.period);
  const db = getDb();
  const rows = await scope(
    db("transactions").whereBetween("date", [from, to]).andWhere({ is_income: false }),
    ctx,
  )
    .select("category")
    .sum({ total: "amount" })
    .count({ count: "id" })
    .groupBy("category")
    .orderBy("total", "desc");
  return {
    period: input.period,
    from,
    to,
    breakdown: rows.map((r: Record<string, unknown>) => ({
      category: String(r.category),
      total: Number(r.total as number | string),
      count: Number(r.count as number | string),
    })),
  };
}

// ---------- list_entries ----------

export const ListEntriesSchema = z.object({
  date_from: DateString.optional().describe("Filter from this date (YYYY-MM-DD)"),
  date_to: DateString.optional().describe("Filter up to this date (YYYY-MM-DD)"),
  category: z.string().optional().describe("Filter by category"),
  payment_method: z.string().optional().describe("Filter by payment method"),
  is_income: z.boolean().optional().describe("true = income only, false = spending only"),
  limit: z.number().int().positive().max(200).optional().describe("Max rows, default 50"),
});

export async function listEntries(input: z.infer<typeof ListEntriesSchema>, ctx: AuthCtx = SYS_CTX) {
  need(ctx, PERMS.read);
  const db = getDb();
  const q = scope(db("transactions").orderBy("date", "desc").orderBy("id", "desc"), ctx);
  if (input.date_from) q.andWhere("date", ">=", input.date_from);
  if (input.date_to) q.andWhere("date", "<=", input.date_to);
  if (input.category) q.andWhere({ category: normCat(input.category) });
  if (input.payment_method) q.andWhere({ payment_method: input.payment_method });
  if (input.is_income !== undefined) q.andWhere({ is_income: input.is_income });
  q.limit(input.limit ?? 50);
  const rows = (await q.select()) as TransactionRow[];
  return rows.map(normalizeRow);
}

// ---------- edit_entry ----------

export const EditEntrySchema = z.object({
  id: z.number().int().positive().describe("Entry id"),
  amount: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  note: z.string().nullable().optional().describe("null clears the note"),
  date: DateString.optional(),
  payment_method: z.string().nullable().optional(),
  currency: z.string().length(3).optional(),
  is_income: z.boolean().optional(),
});

export async function editEntry(input: z.infer<typeof EditEntrySchema>, ctx: AuthCtx = SYS_CTX) {
  need(ctx, PERMS.update);
  const db = getDb();
  const existing = await scope(db("transactions").where({ id: input.id }), ctx).first();
  if (!existing) throw new Error(`Entry #${input.id} not found`);
  const patch: Record<string, unknown> = {};
  if (input.amount !== undefined) patch.amount = round2(input.amount);
  if (input.category !== undefined) patch.category = normCat(input.category);
  if (input.note !== undefined) patch.note = input.note;
  if (input.date !== undefined) {
    if (!isValidDate(input.date)) throw new Error(`Invalid date: ${input.date}`);
    patch.date = input.date;
  }
  if (input.payment_method !== undefined) patch.payment_method = input.payment_method;
  if (input.currency !== undefined) patch.currency = input.currency.toUpperCase();
  if (input.is_income !== undefined) patch.is_income = input.is_income;
  if (Object.keys(patch).length === 0) throw new Error("No fields to update");
  patch.updated_at = nowTunisDateTime();
  await db("transactions").where({ id: input.id }).update(patch);
  const row = await db("transactions").where({ id: input.id }).first();
  return normalizeRow(row as TransactionRow);
}

// ---------- delete_entry ----------

export const DeleteEntrySchema = z.object({
  id: z.number().int().positive().describe("Entry id"),
});

export async function deleteEntry(
  input: z.infer<typeof DeleteEntrySchema>,
  ctx: AuthCtx = SYS_CTX,
) {
  need(ctx, PERMS.delete);
  const db = getDb();
  const deleted = await scope(db("transactions").where({ id: input.id }), ctx).del();
  if (!deleted) throw new Error(`Entry #${input.id} not found`);
  return { deleted: true, id: input.id };
}
