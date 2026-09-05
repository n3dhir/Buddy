import type { Knex } from "knex";

// Accounts + scoped API tokens. Everyone is equal: no roles.
// - users: bcrypt password hashes
// - tokens: opaque values, sha256 at rest, shown once at creation.
//   Each token carries the scopes its owner chose.
// - transactions.user_id: row ownership (legacy NULL rows are
//   inherited by the first registrant in app code).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (t) => {
    t.increments("id").primary();
    t.string("username").unique().notNullable();
    t.string("password_hash").notNullable();
    t.timestamps(true, true);
  });
  await knex.schema.createTable("tokens", (t) => {
    t.increments("id").primary();
    t.integer("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("name").notNullable().defaultTo("");
    t.string("token_hash").unique().notNullable();
    t.text("scopes").notNullable().defaultTo("[]");
    t.timestamps(true, true);
  });
  await knex.schema.alterTable("transactions", (t) => {
    t.integer("user_id").nullable().references("id").inTable("users");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("transactions", (t) => {
    t.dropColumn("user_id");
  });
  await knex.schema.dropTableIfExists("tokens");
  await knex.schema.dropTableIfExists("users");
}
