import express from "express";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ZodError } from "zod";
import { createServer } from "./server.js";
import { handleTelegramUpdate } from "./telegram/bot.js";
import {
  authenticate,
  authForToken,
  createToken,
  ctxFor,
  listTokens,
  register,
  revokeToken,
  SCOPES,
  sysCtx,
  updateToken,
} from "./tools/users.js";
import {
  CategoryBreakdownSchema,
  DeleteEntrySchema,
  EditEntrySchema,
  GetSummarySchema,
  ListEntriesSchema,
  LogEntrySchema,
  deleteEntry,
  editEntry,
  getCategoryBreakdown,
  getSummary,
  listEntries,
  logExpense,
  logIncome,
} from "./tools/finance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// Auth: users table. Two credential kinds, both Bearer:
// - UI session: JWT {sub: userId} from /api/auth/login (full entry scopes)
// - API tokens: opaque, user-created with chosen scopes, hashed at rest
function jwtSecret() {
  // Renamed RAFIQ_* -> BUDDY_*; old names still honored so existing
  // deploys keep working without an .env change.
  return process.env.BUDDY_JWT_SECRET ?? process.env.RAFIQ_JWT_SECRET;
}

function mintSession(userId) {
  return jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: "30d" });
}

async function resolveAuth(req) {
  const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!bearer) fail("unauthorized", 401);
  try {
    return await authForToken(bearer);
  } catch {
    // fall through to session JWT
  }
  try {
    const payload: any = jwt.verify(bearer, jwtSecret());
    return ctxFor(Number(payload.sub), [...SCOPES]);
  } catch {
    fail("unauthorized", 401);
  }
}

function fail(msg, status) {
  throw Object.assign(new Error(msg), { status });
}

function requireAuth(req, res, next) {
  resolveAuth(req).then(
    (auth) => {
      (req as any).auth = auth;
      next();
    },
    (e) => res.status(401).json({ error: e.message ?? "unauthorized" }),
  );
}

const authOf = (req) => (req as any).auth ?? sysCtx();

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/auth/")) return next();
  requireAuth(req, res, next);
});

app.post("/api/auth/register", (req, res) =>
  send(res, async () => {
    const user = await register(req.body);
    return { token: mintSession(user.id), user };
  }),
);

app.post("/api/auth/login", (req, res) =>
  send(res, async () => {
    const user = await authenticate(req.body);
    return { token: mintSession(user.id), user };
  }),
);

app.get("/api/tokens", (req, res) =>
  send(res, async () => listTokens(authOf(req).userId)),
);

app.post("/api/tokens", (req, res) =>
  send(res, async () => createToken(authOf(req).userId, req.body)),
);

app.delete("/api/tokens/:id", (req, res) =>
  send(res, async () => revokeToken(authOf(req).userId, Number(req.params.id))),
);

app.patch("/api/tokens/:id", (req, res) =>
  send(res, async () => updateToken(authOf(req).userId, Number(req.params.id), req.body)),
);

// Remote MCP (Streamable HTTP, stateless) — same tools, acting as the caller.
async function handleMcp(req, res) {
  const server = createServer(() => authOf(req));
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: "mcp error" });
  }
}
app.post("/mcp", requireAuth, handleMcp);
app.get("/mcp", requireAuth, handleMcp);
app.delete("/mcp", requireAuth, handleMcp);

// Telegram bot (webhook only). Telegram retries non-2xx, so always
// answer 200: handler failures are logged, the user gets the error
// as a chat message on the next update instead of a redelivery storm.
app.post("/telegram/webhook", (req, res) => {
  Promise.resolve()
    .then(async () => {
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
      if (!secret || req.query.secret !== secret) fail("forbidden", 403);
      await handleTelegramUpdate(req.body);
      return { ok: true };
    })
    .then(
      (data) => res.json(data),
      (e) => {
        console.error("telegram webhook:", e instanceof Error ? e.message : e);
        res.json({ ok: true });
      },
    );
});

function send(res, fn) {
  // Promise.resolve().then() so sync Zod throws become rejections too.
  Promise.resolve().then(fn).then(
    (data) => res.json(data),
    (e) => {
      if (e instanceof ZodError) {
        res.status(400).json({ error: "invalid input", issues: e.issues });
      } else if (typeof e.status === "number") {
        res.status(e.status).json({ error: e.message });
      } else if (e instanceof Error && /not found/i.test(e.message)) {
        res.status(404).json({ error: e.message });
      } else if (e instanceof Error && /no fields to update/i.test(e.message)) {
        res.status(400).json({ error: e.message });
      } else {
        console.error(e);
        res.status(500).json({ error: "internal error" });
      }
    },
  );
}

app.post("/api/entries/expense", (req, res) =>
  send(res, () => logExpense(LogEntrySchema.parse(req.body), authOf(req))),
);

app.post("/api/entries/income", (req, res) =>
  send(res, () => logIncome(LogEntrySchema.parse(req.body), authOf(req))),
);

app.get("/api/summary", (req, res) =>
  send(res, () =>
    getSummary(
      GetSummarySchema.parse({
        period: req.query.period,
        category: req.query.category,
      }),
      authOf(req),
    ),
  ),
);

app.get("/api/breakdown", (req, res) =>
  send(res, () =>
    getCategoryBreakdown(
      CategoryBreakdownSchema.parse({ period: req.query.period }),
      authOf(req),
    ),
  ),
);

app.get("/api/entries", (req, res) =>
  send(res, () =>
    listEntries(
      ListEntriesSchema.parse({
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        category: req.query.category,
        payment_method: req.query.payment_method,
        is_income:
          req.query.is_income === undefined
            ? undefined
            : req.query.is_income === "true",
        limit:
          req.query.limit === undefined ? undefined : Number(req.query.limit),
      }),
      authOf(req),
    ),
  ),
);

app.patch("/api/entries/:id", (req, res) =>
  send(res, () =>
    editEntry(EditEntrySchema.parse({ ...req.body, id: Number(req.params.id) }), authOf(req)),
  ),
);

app.delete("/api/entries/:id", (req, res) =>
  send(res, () =>
    deleteEntry(DeleteEntrySchema.parse({ id: Number(req.params.id) }), authOf(req)),
  ),
);

// Frontend (served after `npm run build --prefix web`).
const webDist = path.join(__dirname, "..", "web", "dist");
app.use(express.static(webDist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(webDist, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "web build not found" });
  });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`buddy web on :${port}`));
