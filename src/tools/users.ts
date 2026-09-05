import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { nowTunisDateTime } from "./utils.js";

export const PERMS = {
  create: "entries:create",
  read: "entries:read",
  update: "entries:update",
  delete: "entries:delete",
  manageUsers: "users:manage",
} as const;

export interface AuthCtx {
  userId: number | null;
  isAdmin: boolean;
  can: (perm: string) => boolean;
}

/** Full access: local stdio, smoke tests, direct calls. */
export const SYS_CTX: AuthCtx = {
  userId: null,
  isAdmin: true,
  can: () => true,
};

export function need(ctx: AuthCtx, perm: string): void {
  if (!ctx.can(perm)) throw Object.assign(new Error(`forbidden: needs ${perm}`), { status: 403 });
}

export async function permsFor(userId: number): Promise<{ role: string; perms: string[] }> {
  const db = getDb();
  const user = await db("users").where({ id: userId }).first();
  if (!user) throw new Error("user not found");
  const role = await db("roles").where({ id: user.role_id }).first();
  const rows = await db("role_permissions")
    .join("permissions", "permissions.id", "role_permissions.permission_id")
    .where({ role_id: user.role_id })
    .select("permissions.name as name");
  return { role: role.name as string, perms: rows.map((r) => r.name as string) };
}

export function ctxFor(userId: number, role: string, perms: string[]): AuthCtx {
  const set = new Set(perms);
  return { userId, isAdmin: role === "admin", can: (p) => set.has(p) };
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
  role: string;
}

async function toPublicUser(id: number): Promise<PublicUser> {
  const { role } = await permsFor(id);
  const db = getDb();
  const user = await db("users").where({ id }).first();
  return { id, username: user.username as string, role };
}

/** First registrant becomes admin and inherits legacy (ownerless) rows. */
export async function register(input: z.infer<typeof RegisterSchema>): Promise<PublicUser> {
  if (process.env.ALLOW_REGISTER === "false") {
    throw Object.assign(new Error("registration is closed"), { status: 403 });
  }
  const { username, password } = RegisterSchema.parse(input);
  const db = getDb();
  const name = username.trim().toLowerCase();
  if (await db("users").where({ username: name }).first()) {
    throw Object.assign(new Error("username taken"), { status: 409 });
  }
  const [{ count }] = await db("users").count({ count: "id" });
  const isFirst = Number(count) === 0;
  const role = await db("roles").where({ name: isFirst ? "admin" : "user" }).first();
  const [id] = await db("users")
    .insert({
      username: name,
      password_hash: await bcrypt.hash(password, 10),
      role_id: role.id,
      created_at: nowTunisDateTime(),
      updated_at: nowTunisDateTime(),
    })
    .returning("id");
  const userId = typeof id === "object" ? (id as { id: number }).id : (id as number);
  if (isFirst) {
    await db("transactions").whereNull("user_id").update({ user_id: userId });
  }
  return toPublicUser(userId);
}

export async function authenticate(input: z.infer<typeof LoginSchema>): Promise<PublicUser> {
  const { username, password } = LoginSchema.parse(input);
  const db = getDb();
  const user = await db("users").where({ username: username.trim().toLowerCase() }).first();
  if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
    throw Object.assign(new Error("invalid credentials"), { status: 401 });
  }
  return toPublicUser(user.id as number);
}

export async function listUsers(ctx: AuthCtx = SYS_CTX): Promise<PublicUser[]> {
  need(ctx, PERMS.manageUsers);
  const db = getDb();
  const users = await db("users").orderBy("id").select("id");
  return Promise.all(users.map((u) => toPublicUser(u.id as number)));
}

export const SetRoleSchema = z.object({
  id: z.number().int().positive(),
  role: z.enum(["admin", "user"]),
});

export async function setRole(
  input: z.infer<typeof SetRoleSchema>,
  ctx: AuthCtx = SYS_CTX,
): Promise<PublicUser> {
  need(ctx, PERMS.manageUsers);
  const { id, role } = SetRoleSchema.parse(input);
  const db = getDb();
  const target = await db("roles").where({ name: role }).first();
  if (!(await db("users").where({ id }).first())) {
    throw new Error(`user #${id} not found`);
  }
  await db("users").where({ id }).update({ role_id: target.id });
  return toPublicUser(id);
}
