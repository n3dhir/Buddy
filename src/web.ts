import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ZodError } from "zod";
import { createServer } from "./server.js";
import {
  authenticate,
  ctxFor,
  listUsers,
  LoginSchema,
  permsFor,
  register,
  RegisterSchema,
  setRole,
  SetRoleSchema,
  SYS_CTX,
  type AuthCtx,
} from "./tools/users.js";

type AuthedRequest = Request & { auth: AuthCtx };
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

// Auth: users table + password login -> JWT ({sub: userId}).
// Fresh DB (no users yet) = open, so the first account can register.
// Otherwise every /api (except health/auth) and /mcp call needs a JWT,
// resolved to a live AuthCtx (role + permissions) per request.
const JWT_EXPIRY = "365d";

function mintToken(userId: number): string {
  return jwt.sign(
    { sub: userId },
    process.env.RAFIQ_JWT_SECRET as string,
    { expiresIn: JWT_EXPIRY },
  );
}

async function resolveAuth(req: Request): Promise<AuthCtx> {
  const db = (await import("./db/client.js")).getDb();
  const [{ count }] = await db("users").count({ count: "id" });
  if (Number(count) === 0) return SYS_CTX;
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    const payload = jwt.verify(token, process.env.RAFIQ_JWT_SECRET as string) as unknown as {
      sub: number;
    };
    const { role, perms } = await permsFor(Number(payload.sub));
    return ctxFor(Number(payload.sub), role, perms);
  } catch {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  resolveAuth(req).then(
    (auth) => {
      (req as AuthedRequest).auth = auth;
      next();
    },
    (e: unknown) => {
      res.status(401).json({ error: e instanceof Error ? e.message : "unauthorized" });
    },
  );
}

const authOf = (req: Request): AuthCtx => (req as AuthedRequest).auth ?? SYS_CTX;

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/auth/")) return next();
  requireAuth(req, res, next);
});

app.post("/api/auth/register", (req: Request, res: Response) =>
  send(res, async () => {
    const user = await register(req.body);
    return { token: mintToken(user.id), user };
  }),
);

app.post("/api/auth/login", (req: Request, res: Response) =>
  send(res, async () => {
    const user = await authenticate(req.body);
    return { token: mintToken(user.id), user };
  }),
);

app.get("/api/users", (req: Request, res: Response) =>
  send(res, () => listUsers(authOf(req))),
);

app.patch("/api/users/:id", (req: Request, res: Response) =>
  send(res, () =>
    setRole({ id: Number(req.params.id), role: req.body?.role }, authOf(req)),
  ),
);

// Remote MCP (Streamable HTTP, stateless) — same tools, acting as the caller.
async function handleMcp(req: Request, res: Response) {
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
  send(res, () => logExpense(LogEntrySchema.parse(req.body), authOf(req))),
);

app.post("/api/entries/income", (req: Request, res: Response) =>
  send(res, () => logIncome(LogEntrySchema.parse(req.body), authOf(req))),
);

app.get("/api/summary", (req: Request, res: Response) =>
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

app.get("/api/breakdown", (req: Request, res: Response) =>
  send(res, () =>
    getCategoryBreakdown(
      CategoryBreakdownSchema.parse({ period: req.query.period }),
      authOf(req),
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
      authOf(req),
    ),
  ),
);

app.patch("/api/entries/:id", (req: Request, res: Response) =>
  send(res, () =>
    editEntry(EditEntrySchema.parse({ ...req.body, id: Number(req.params.id) }), authOf(req)),
  ),
);

app.delete("/api/entries/:id", (req: Request, res: Response) =>
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
app.listen(port, () => console.log(`rafiq web on :${port}`));
