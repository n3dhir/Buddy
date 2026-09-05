export async function up(knex) {
    await knex.schema.renameTable("expenses", "transactions");
}
export async function down(knex) {
    await knex.schema.renameTable("transactions", "expenses");
}
//# sourceMappingURL=20250904000001_rename_expenses_to_transactions.js.map