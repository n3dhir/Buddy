# Rafiq — personal finance (MCP + web)

Expense/income tracker exposed two ways, one shared Postgres DB:
chat via MCP tools, full read/write UI via web. Refresh the page to see
chat-made changes (no live sync by design).

## Setup

```bash
cp .env.example .env   # set DATABASE_URL, PORT
npm install
npm run migrate        # creates `transactions` table
npm run import:pg      # one-off: copy legacy rafiq.db (SQLite) rows into PG
```

Legacy SQLite fallback (smoke tests): `DB_CLIENT=sqlite RAFIQ_DB_PATH=...`.

## Run

Two processes, one DB:

```bash
npm start          # MCP stdio server (chat) — dist/server.js
npm run start:web  # web API + UI on :3000 — dist/web.js
```

Dev:

```bash
npm run dev        # MCP server via tsx
npm run dev:api    # Express API via tsx (:3000)
npm run dev:web    # Vite dev server (proxies /api → :3000)
npm run test:smoke # tool checks (in-memory SQLite)
```

## REST API (same functions as the MCP tools)

| Method | Route | Tool |
|---|---|---|
| POST | `/api/entries/expense` | `log_expense` |
| POST | `/api/entries/income` | `log_income` |
| GET | `/api/summary?period=&category?` | `get_summary` |
| GET | `/api/breakdown?period=` | `get_category_breakdown` |
| GET | `/api/entries?date_from&date_to&category&payment_method&is_income&limit` | `list_entries` |
| PATCH | `/api/entries/:id` | `edit_entry` |
| DELETE | `/api/entries/:id` | `delete_entry` |

Errors: 400 invalid input (zod issues), 404 unknown id.

## MCP tools

`log_expense`, `log_income`, `get_summary`, `get_category_breakdown`
(spending only), `list_entries`, `edit_entry`, `delete_entry`.

`payment_method` is free-form (e.g. `cash`, `card`, `bank transfer`).
Default currency `TND`, default date = today in Tunisia time (`Africa/Tunis`
= fixed UTC+1). `week` = last 7 days, `month`/`year` = calendar.

## Claude Desktop / Code (local stdio)

```json
{
  "mcpServers": {
    "rafiq": {
      "command": "node",
      "args": ["/mnt/data/projects/Rafiq/dist/server.js"],
      "env": { "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/rafiq" }
    }
  }
}
```

## Deploy (VPS + remote MCP)

Same Postgres, two front doors: public web UI and remote MCP over HTTPS.
No DB port is ever opened — both go through the app.

## Auth: accounts + scoped tokens (no roles)

Everyone is equal. Accounts live in the DB (`users`, bcrypt hashes).
Registration is always open; the first registrant inherits legacy
ownerless rows. Every row belongs to the user who created it.

- `POST /api/auth/register`, `POST /api/auth/login` → session JWT
  (`RAFIQ_JWT_SECRET`, 30d) for the UI.
- `GET/POST /api/tokens`, `DELETE /api/tokens/:id` → mint as many tokens
  as you want, each with the scopes **you** pick (`entries:create/read/
  update/delete`). Shown once (`rafiq_…`, sha256 at rest), revocable.
- Every tool and endpoint executes as the caller: a token without
  `entries:delete` gets 403 on deletes; rows are scoped per user.
  Your token *is* your MCP credential (same bearer header).

On the VPS (pm2 + system Postgres + nginx):

```bash
git clone <repo> && cd rafiq
npm install && npm run build --prefix web
cp .env.example .env   # DATABASE_URL (local PG), PORT=3000
                       # RAFIQ_PASSWORD=<pick one>, RAFIQ_JWT_SECRET=$(openssl rand -hex 32)
npm run migrate
npm run build
pm2 start dist/web.js --name rafiq-web && pm2 save
# reverse-proxy + TLS in front (nginx/Caddy), forwarding to :3000
```

On localhost, point the MCP client at the server (Claude Code shown).
Get a JWT first: `curl -s -X POST https://rafiq.example.com/api/login
-H 'Content-Type: application/json' -d '{"password":"..."}'`, then:

```bash
claude mcp add --transport http rafiq https://rafiq.example.com/mcp \
  --header "Authorization: Bearer <JWT>"
```

MCP endpoint notes: Streamable HTTP, stateless (one POST per request —
initialize, then call tools normally). `/mcp` GET/DELETE return 405, as
expected for stateless servers.

## Layout

```
src/db/         knexfile, client (pg default, sqlite fallback), migrations/
src/tools/      finance.ts (7 tools) + utils.ts (Tunis time, normalize)
src/web.ts      Express API + static frontend serving
src/server.ts   MCP stdio entry
web/            Vite + React + Tailwind UI (dashboard + entries CRUD)
scripts/        smoke.ts, import-sqlite-to-pg.ts
```
