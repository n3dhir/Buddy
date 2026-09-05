const eyebrow = "text-[13px] font-medium tracking-[0.4px] text-ink-subtle";

const CODE = `// one logic core, three front doors
tools/logExpense(input)      // shared function + zod schema
  ├─ stdio  → Claude Desktop/Code, local          // server.ts
  ├─ https  → POST /mcp (Streamable HTTP)         // web.ts
  └─ rest   → POST /api/entries/expense           // web.ts

every call: bearer → AuthCtx → scope(user_id) → Postgres`;

const DOORS = [
  {
    name: "MCP · stdio",
    endpoint: "node dist/server.js",
    text: "Local client process. Trusted, full access — your machine, your data.",
  },
  {
    name: "MCP · HTTPS",
    endpoint: "POST /mcp",
    text: "Same 7 tools over Streamable HTTP. Bearer token in, per-user scoping throughout.",
  },
  {
    name: "REST + UI",
    endpoint: "/api/* · /dashboard",
    text: "Plain JSON for scripts, React dashboard for humans. Identical validation.",
  },
];

export default function Architecture() {
  return (
    <section id="architecture" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
      <p className={eyebrow}>ARCHITECTURE</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        One core. Three doors.
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
        Chat and web can never disagree: both are thin transports over the same
        functions, validated by the same zod schemas, scoped to the same user.
      </p>
      <div className="edge mt-8 rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
        <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-muted">
          {CODE.split("\n").map((line, i) => (
            <div key={i} className="flex gap-4">
              <span className="w-6 shrink-0 select-none text-right text-ink-tertiary">{i + 1}</span>
              <code>
                {line.startsWith("//") ? (
                  <span className="text-brand">{line}</span>
                ) : (
                  line
                )}
              </code>
            </div>
          ))}
        </pre>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {DOORS.map((d) => (
          <div key={d.name} className="edge rounded-xl border border-hairline bg-surface-1 p-6">
            <p className="text-[15px] font-medium text-ink">{d.name}</p>
            <p className="mt-1.5 font-mono text-xs text-brand">{d.endpoint}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{d.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
