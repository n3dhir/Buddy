import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sysCtx } from "./tools/users.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CategoryBreakdownSchema, DeleteEntrySchema, EditEntrySchema, GetSummarySchema, ListEntriesSchema, LogEntrySchema, deleteEntry, editEntry, getCategoryBreakdown, getSummary, listEntries, logExpense, logIncome, } from "./tools/finance.js";
function json(data) {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function err(e) {
    const message = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text", text: message }], isError: true };
}
export function createServer(auth = () => sysCtx()) {
    const server = new McpServer({ name: "rafiq", version: "0.1.0" });
    server.registerTool("log_expense", {
        title: "Log expense",
        description: "Record a spending entry. payment_method is free-form (e.g. cash, card, bank transfer).",
        inputSchema: LogEntrySchema.shape,
    }, async (args) => {
        try {
            return json(await logExpense(LogEntrySchema.parse(args), auth()));
        }
        catch (e) {
            return err(e);
        }
    });
    server.registerTool("log_income", {
        title: "Log income",
        description: "Record an income entry.",
        inputSchema: LogEntrySchema.shape,
    }, async (args) => {
        try {
            return json(await logIncome(LogEntrySchema.parse(args), auth()));
        }
        catch (e) {
            return err(e);
        }
    });
    server.registerTool("get_summary", {
        title: "Get summary",
        description: "Totals for a period (week = last 7 days, month = calendar month, year = calendar year).",
        inputSchema: GetSummarySchema.shape,
    }, async (args) => {
        try {
            return json(await getSummary(GetSummarySchema.parse(args), auth()));
        }
        catch (e) {
            return err(e);
        }
    });
    server.registerTool("get_category_breakdown", {
        title: "Category breakdown",
        description: "Spending grouped by category for a period (excludes income).",
        inputSchema: CategoryBreakdownSchema.shape,
    }, async (args) => {
        try {
            return json(await getCategoryBreakdown(CategoryBreakdownSchema.parse(args), auth()));
        }
        catch (e) {
            return err(e);
        }
    });
    server.registerTool("list_entries", {
        title: "List entries",
        description: "List entries with optional date/category/payment_method filters.",
        inputSchema: ListEntriesSchema.shape,
    }, async (args) => {
        try {
            return json(await listEntries(ListEntriesSchema.parse(args), auth()));
        }
        catch (e) {
            return err(e);
        }
    });
    server.registerTool("edit_entry", {
        title: "Edit expense",
        description: "Partially update an entry by id.",
        inputSchema: EditEntrySchema.shape,
    }, async (args) => {
        try {
            return json(await editEntry(EditEntrySchema.parse(args), auth()));
        }
        catch (e) {
            return err(e);
        }
    });
    server.registerTool("delete_entry", {
        title: "Delete expense",
        description: "Delete an entry by id.",
        inputSchema: DeleteEntrySchema.shape,
    }, async (args) => {
        try {
            return json(await deleteEntry(DeleteEntrySchema.parse(args), auth()));
        }
        catch (e) {
            return err(e);
        }
    });
    return server;
}
async function main() {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map