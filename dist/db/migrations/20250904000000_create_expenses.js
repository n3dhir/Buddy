export async function up(knex) {
    await knex.schema.createTable("expenses", (table) => {
        table.increments("id").primary();
        table.decimal("amount", 10, 2).notNullable();
        table.string("currency", 3).defaultTo("TND");
        table.string("category").notNullable();
        table.string("note").nullable();
        // Free-form: e.g. cash, card, bank transfer. No app-specific wallets.
        table.string("payment_method").nullable();
        table.date("date").notNullable();
        table.boolean("is_income").defaultTo(false);
        table.timestamps(true, true);
    });
}
export async function down(knex) {
    await knex.schema.dropTableIfExists("expenses");
}
//# sourceMappingURL=20250904000000_create_expenses.js.map