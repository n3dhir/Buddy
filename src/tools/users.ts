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

export const PERMS = {
  create: "entries:create",
  read: "entries:read",
  update: "entries:update",
  delete: "entries:delete",
};

// Who's calling: full access when userId is null (local stdio, tests).
export function sysCtx() {
  return { userId: null, can: () => true };
}

export function ctxFor(userId, scopes) {
  const set = new Set(scopes);
  return { userId, can: (p) => set.has(p) };
}

function deny(msg, status) {
  throw Object.assign(new Error(msg), { status });
}

export function need(ctx, perm) {
  if (!ctx.can(perm)) deny(`forbidden: needs ${perm}`, 403);
}

export const RegisterSchema = z.object({
  username: z.string().min(3).max(32).describe("Unique username"),
  password: z.string().min(8).describe("Min 8 characters"),
});

export const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const CreateTokenSchema = z.object({
  name: z.string().max(64).optional().describe("Label, e.g. claude-code"),
  scopes: z.array(z.enum(SCOPES)).min(1).describe("Permissions for this token"),
});

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export async function register(input) {
  const { username, password } = RegisterSchema.parse(input);
  const db = getDb();
  const name = username.trim().toLowerCase();
  if (await db("users").where({ username: name }).first()) {
    deny("username taken", 409);
  }
  const [id] = await db("users")
    .insert({
      username: name,
      password_hash: await bcrypt.hash(password, 10),
      created_at: nowTunisDateTime(),
      updated_at: nowTunisDateTime(),
    })
    .returning("id");
  const userId = typeof id === "object" ? id.id : id;
  return { id: userId, username: name };
}

export async function authenticate(input) {
  const { username, password } = LoginSchema.parse(input);
  const db = getDb();
  const user = await db("users").where({ username: username.trim().toLowerCase() }).first();
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    deny("invalid credentials", 401);
  }
  return { id: user.id, username: user.username };
}

export async function createToken(userId, input) {
  const { name, scopes } = CreateTokenSchema.parse(input);
  const db = getDb();
  const token = `rafiq_${crypto.randomBytes(24).toString("hex")}`;
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
  const tokenId = typeof id === "object" ? id.id : id;
  const row = await db("tokens").where({ id: tokenId }).first();
  return { ...toTokenInfo(row), token };
}

export const UpdateTokenSchema = z.object({
  name: z.string().max(64).optional().describe("New label"),
  scopes: z.array(z.enum(SCOPES)).min(1).describe("New permissions for this token"),
});

export async function updateToken(userId, id, input) {
  const patch = UpdateTokenSchema.parse(input);
  if (Object.keys(patch).length === 0) throw new Error("Nothing to update");
  const data: any = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.scopes !== undefined) data.scopes = JSON.stringify(patch.scopes);
  const db = getDb();
  const updated = await db("tokens").where({ id, user_id: userId }).update(data);
  if (!updated) throw new Error(`token #${id} not found`);
  const row = await db("tokens").where({ id }).first();
  return toTokenInfo(row);
}

export async function listTokens(userId) {
  const db = getDb();
  const rows = await db("tokens").where({ user_id: userId }).orderBy("id").select();
  return rows.map(toTokenInfo);
}

export async function revokeToken(userId, id) {
  const db = getDb();
  const deleted = await db("tokens").where({ id, user_id: userId }).del();
  if (!deleted) throw new Error(`token #${id} not found`);
  return { revoked: true };
}

function toTokenInfo(row) {
  return {
    id: row.id,
    name: row.name,
    scopes: JSON.parse(row.scopes),
    created_at: row.created_at instanceof Date ? toTunisDateTime(row.created_at) : String(row.created_at),
  };
}

/** Resolve a bearer token to its owner's scoped context. */
export async function authForToken(bearer) {
  const db = getDb();
  const row = await db("tokens").where({ token_hash: hashToken(bearer) }).first();
  if (!row) deny("unauthorized", 401);
  return ctxFor(row.user_id, JSON.parse(row.scopes));
}
