import crypto from "node:crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z, ZodError } from "zod";
import { createServer } from "./server.js";
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

// Password login -> JWT. Single user: one password (RAFIQ_PASSWORD),
// one signing secret (RAFIQ_JWT_SECRET), tokens valid 1 year.
// Both unset = open (local dev) with a warning; set them in production.
const JWT_EXPIRY = "365d";

function authConfigured(): boolean {
  return Boolean(process.env.RAFIQ_PASSWORD && process.env.RAFIQ_JWT_SECRET);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!authConfigured()) {
    console.warn("RAFIQ_PASSWORD/JWT_SECRET unset — API/MCP open. Set them in production.");
    return next();
  }
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    jwt.verify(token, process.env.RAFIQ_JWT_SECRET as string);
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

function checkPassword(password: unknown): boolean {
  const expected = process.env.RAFIQ_PASSWORD ?? "";
  if (!expected || typeof password !== "string") return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/login") return next();
  requireAuth(req, res, next);
});

app.post("/api/login", (req: Request, res: Response) =>
  send(res, async () => {
    if (!authConfigured()) return { token: null, open: true };
    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!checkPassword(password)) {
      const e = new Error("invalid password") as Error & { status?: number };
      e.status = 401;
      throw e;
    }
    const token = jwt.sign(
      { sub: "rafiq" },
      process.env.RAFIQ_JWT_SECRET as string,
      { expiresIn: JWT_EXPIRY },
    );
    return { token };
  }),
);

// Remote MCP (Streamable HTTP, stateless) — same tools as the stdio server.
async function handleMcp(req: Request, res: Response) {
  const server = createServer();
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

function send(res: Response, fn: () => Promise<unknown>) {
  // Promise.resolve().then() so sync Zod throws become rejections too.
  Promise.resolve().then(fn).then(
    (data) => res.json(data),
    (e: unknown) => {
      const status =
        e instanceof Error
          ? (e as unknown as { status?: unknown }).status
          : undefined;
      if (e instanceof ZodError) {
        res.status(400).json({ error: "invalid input", issues: e.issues });
      } else if (typeof status === "number") {
        res.status(status).json({ error: (e as Error).message });
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

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/entries/expense", (req: Request, res: Response) =>
  send(res, () => logExpense(LogEntrySchema.parse(req.body))),
);

app.post("/api/entries/income", (req: Request, res: Response) =>
  send(res, () => logIncome(LogEntrySchema.parse(req.body))),
);

app.get("/api/summary", (req: Request, res: Response) =>
  send(res, () =>
    getSummary(
      GetSummarySchema.parse({
        period: req.query.period,
        category: req.query.category,
      }),
    ),
  ),
);

app.get("/api/breakdown", (req: Request, res: Response) =>
  send(res, () =>
    getCategoryBreakdown(
      CategoryBreakdownSchema.parse({ period: req.query.period }),
    ),
  ),
);

app.get("/api/entries", (req: Request, res: Response) =>
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
    ),
  ),
);

app.patch("/api/entries/:id", (req: Request, res: Response) =>
  send(res, () =>
    editEntry(EditEntrySchema.parse({ ...req.body, id: Number(req.params.id) })),
  ),
);

app.delete("/api/entries/:id", (req: Request, res: Response) =>
  send(res, () =>
    deleteEntry(DeleteEntrySchema.parse({ id: Number(req.params.id) })),
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
app.listen(port, () => console.log(`rafiq web on :${port}`));
