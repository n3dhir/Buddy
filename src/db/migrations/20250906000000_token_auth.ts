import type { Knex } from "knex";

// Replaces role-based auth with per-user tokens carrying user-chosen scopes.
// - users lose role_id; roles/permissions/role_permissions go away
// - tokens: opaque, hashed at rest, shown once at creation
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("tokens", (t) => {
    t.increments("id").primary();
    t.integer("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("name").notNullable().defaultTo("");
    t.string("token_hash").unique().notNullable();
    t.text("scopes").notNullable().defaultTo("[]");
    t.timestamps(true, true);
  });
  await knex.schema.dropTableIfExists("role_permissions");
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("role_id");
  });
  await knex.schema.dropTableIfExists("permissions");
  await knex.schema.dropTableIfExists("roles");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("tokens");
}
