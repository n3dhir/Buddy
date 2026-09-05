import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { nowTunisDateTime, toTunisDateTime } from "./utils.js";

// Scopes a token can carry. Users pick any subset per token.
export const SCOPES = [
  "entries:create",
  "entries:read",
  "entries:update",
  "entries:delete",
] as const;

export type Scope = (typeof SCOPES)[number];

export const PERMS = {
  create: "entries:create",
  read: "entries:read",
  update: "entries:update",
  delete: "entries:delete",
} as const;

export interface AuthCtx {
  userId: number | null;
  can: (perm: string) => boolean;
}

/** Full access: local stdio, smoke tests, direct calls, fresh DB. */
export const SYS_CTX: AuthCtx = {
  userId: null,
  can: () => true,
};

export function need(ctx: AuthCtx, perm: string): void {
  if (!ctx.can(perm)) throw Object.assign(new Error(`forbidden: needs ${perm}`), { status: 403 });
}

export function ctxFor(userId: number, scopes: string[]): AuthCtx {
  const set = new Set(scopes);
  return { userId, can: (p) => set.has(p) };
}

export const RegisterSchema = z.object({
  username: z.string().min(3).max(32).describe("Unique username"),
  password: z.string().min(8).describe("Min 8 characters"),
});

export const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export interface PublicUser {
  id: number;
  username: string;
}

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

function newToken(): string {
  return `rafiq_${crypto.randomBytes(24).toString("hex")}`;
}

/** First registrant inherits legacy (ownerless) rows. */
export async function register(input: z.infer<typeof RegisterSchema>): Promise<PublicUser> {
  const { username, password } = RegisterSchema.parse(input);
  const db = getDb();
  const name = username.trim().toLowerCase();
  if (await db("users").where({ username: name }).first()) {
    throw Object.assign(new Error("username taken"), { status: 409 });
  }
  const [{ count }] = await db("users").count({ count: "id" });
  const isFirst = Number(count) === 0;
  const [id] = await db("users")
    .insert({
      username: name,
      password_hash: await bcrypt.hash(password, 10),
      created_at: nowTunisDateTime(),
      updated_at: nowTunisDateTime(),
    })
    .returning("id");
  const userId = typeof id === "object" ? (id as { id: number }).id : (id as number);
  if (isFirst) {
    await db("transactions").whereNull("user_id").update({ user_id: userId });
  }
  return { id: userId, username: name };
}

export async function authenticate(input: z.infer<typeof LoginSchema>): Promise<PublicUser> {
  const { username, password } = LoginSchema.parse(input);
  const db = getDb();
  const user = await db("users").where({ username: username.trim().toLowerCase() }).first();
  if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
    throw Object.assign(new Error("invalid credentials"), { status: 401 });
  }
  return { id: user.id as number, username: user.username as string };
}

export interface TokenInfo {
  id: number;
  name: string;
  scopes: string[];
  created_at: string;
}

function toTokenInfo(row: Record<string, unknown>): TokenInfo {
  const created = row.created_at;
  return {
    id: row.id as number,
    name: row.name as string,
    scopes: JSON.parse(row.scopes as string) as string[],
    created_at: created instanceof Date ? toTunisDateTime(created) : String(created),
  };
}

export const CreateTokenSchema = z.object({
  name: z.string().max(64).optional().describe("Label, e.g. claude-code"),
  scopes: z.array(z.enum(SCOPES)).min(1).describe("Permissions for this token"),
});

export async function createToken(
  userId: number,
  input: z.infer<typeof CreateTokenSchema>,
): Promise<TokenInfo & { token: string }> {
  const { name, scopes } = CreateTokenSchema.parse(input);
  const db = getDb();
  const token = newToken();
  const [id] = await db("tokens")
    .insert({
      user_id: userId,
      name: name ?? "",
      token_hash: hashToken(token),
      scopes: JSON.stringify(scopes),
      created_at: nowTunisDateTime(),
      updated_at: nowTunisDateTime(),
    })
    .returning("id");
  const tokenId = typeof id === "object" ? (id as { id: number }).id : (id as number);
  const row = await db("tokens").where({ id: tokenId }).first();
  return { ...toTokenInfo(row), token };
}

export async function listTokens(userId: number): Promise<TokenInfo[]> {
  const db = getDb();
  const rows = await db("tokens").where({ user_id: userId }).orderBy("id").select();
  return rows.map(toTokenInfo);
}

export async function revokeToken(userId: number, id: number): Promise<{ revoked: boolean }> {
  const db = getDb();
  const deleted = await db("tokens").where({ id, user_id: userId }).del();
  if (!deleted) throw new Error(`token #${id} not found`);
  return { revoked: true };
}

/** Resolve a bearer token to its owner's scoped context. */
export async function authForToken(bearer: string): Promise<AuthCtx> {
  const db = getDb();
  const row = await db("tokens").where({ token_hash: hashToken(bearer) }).first();
  if (!row) throw Object.assign(new Error("unauthorized"), { status: 401 });
  return ctxFor(row.user_id as number, JSON.parse(row.scopes as string) as string[]);
}
