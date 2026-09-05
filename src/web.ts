import crypto from "node:crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ZodError } from "zod";
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

// Bearer auth for /mcp and /api (except /api/health).
// RAFIQ_API_TOKEN unset = open (local dev) with a warning; set it on the VPS.
function requireToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.RAFIQ_API_TOKEN;
  if (!expected) {
    console.warn("RAFIQ_API_TOKEN unset — API/MCP open. Set it in production.");
    return next();
  }
  const got = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();
  requireToken(req, res, next);
});

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
app.post("/mcp", requireToken, handleMcp);
app.get("/mcp", requireToken, handleMcp);
app.delete("/mcp", requireToken, handleMcp);

function send(res: Response, fn: () => Promise<unknown>) {
  // Promise.resolve().then() so sync Zod throws become rejections too.
  Promise.resolve().then(fn).then(
    (data) => res.json(data),
    (e: unknown) => {
      if (e instanceof ZodError) {
        res.status(400).json({ error: "invalid input", issues: e.issues });
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
