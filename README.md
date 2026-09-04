# Rafiq — personal MCP server

v1: finance / expense tracker. SQLite + Knex + MCP stdio transport.

## Setup

```bash
npm install
npm run migrate   # creates rafiq.db (gitignored)
npm run build
```

## Run

```bash
npm start          # stdio MCP server (dist/server.js)
npm run dev        # tsx, no build
npm run test:smoke # in-memory check of all 7 tools
```

## Claude Desktop / Claude Code

Add as an MCP server with stdio transport:

```json
{
  "mcpServers": {
    "rafiq": {
      "command": "node",
      "args": ["/mnt/data/projects/Rafiq/dist/server.js"],
      "env": { "RAFIQ_DB_PATH": "/mnt/data/projects/Rafiq/rafiq.db" }
    }
  }
}
```

## Tools (v1)

`log_expense`, `log_income`, `get_summary`, `get_category_breakdown`,
`list_entries`, `edit_entry`, `delete_entry`.

`payment_method` is free-form (e.g. `cash`, `card`, `bank transfer`).
Default currency `TND`, default date = today in Tunisia time (`Africa/Tunis`).
`week` = last 7 days, `month`/`year` = calendar.

## Layout

```
src/db/         knexfile, client, migrations/
src/tools/      finance.ts (7 tools)
src/resources/  stub — after tool layer verified
src/prompts/    stub — after tool layer verified
src/server.ts   MCP stdio entry
scripts/smoke.ts in-memory smoke test
```
