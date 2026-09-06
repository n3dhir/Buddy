import type { Knex } from "knex";

// Telegram chat links. One chat links to one account:
// - telegram_chat_id: the Telegram chat (unique, one link per chat)
// - user_id: owner of the linked account
// - token_hash: sha256 of the API token used at /start time. Revoking
//   that token in the web UI automatically kills the link (the bot
//   re-resolves the token row on every message and asks to re-link).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("telegram_links", (t) => {
    t.increments("id").primary();
    t.string("telegram_chat_id").unique().notNullable();
    t.integer("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("token_hash").notNullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("telegram_links");
}
