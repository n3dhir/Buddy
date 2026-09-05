import type { Knex } from "knex";

const PERMISSIONS = [
  "entries:create",
  "entries:read",
  "entries:update",
  "entries:delete",
  "users:manage",
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("roles", (t) => {
    t.increments("id").primary();
    t.string("name").unique().notNullable();
  });
  await knex.schema.createTable("permissions", (t) => {
    t.increments("id").primary();
    t.string("name").unique().notNullable();
  });
  await knex.schema.createTable("role_permissions", (t) => {
    t.integer("role_id").notNullable().references("id").inTable("roles");
    t.integer("permission_id").notNullable().references("id").inTable("permissions");
    t.primary(["role_id", "permission_id"]);
  });
  await knex.schema.createTable("users", (t) => {
    t.increments("id").primary();
    t.string("username").unique().notNullable();
    t.string("password_hash").notNullable();
    t.integer("role_id").notNullable().references("id").inTable("roles");
    t.timestamps(true, true);
  });
  await knex.schema.alterTable("transactions", (t) => {
    t.integer("user_id").nullable().references("id").inTable("users");
  });

  await knex("roles").insert([{ name: "admin" }, { name: "user" }]);
  await knex("permissions").insert(PERMISSIONS.map((name) => ({ name })));
  const admin = await knex("roles").where({ name: "admin" }).first();
  const user = await knex("roles").where({ name: "user" }).first();
  const perms = await knex("permissions").select();
  const byName: Record<string, number> = Object.fromEntries(
    perms.map((p) => [p.name as string, p.id as number]),
  );
  await knex("role_permissions").insert(
    PERMISSIONS.map((name) => ({ role_id: admin.id, permission_id: byName[name] })),
  );
  await knex("role_permissions").insert(
    PERMISSIONS.filter((p) => p.startsWith("entries:")).map((name) => ({
      role_id: user.id,
      permission_id: byName[name],
    })),
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("transactions", (t) => {
    t.dropColumn("user_id");
  });
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("role_permissions");
  await knex.schema.dropTableIfExists("permissions");
  await knex.schema.dropTableIfExists("roles");
}
