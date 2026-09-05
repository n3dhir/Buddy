const eyebrow = "text-[13px] font-medium tracking-[0.4px] text-ink-subtle";

const FEATURES = [
  {
    title: "Tunis-time correctness",
    text: "Dates, stamps, and period boundaries all run on Africa/Tunis — including the pg DATE round-trip most stacks get wrong at midnight.",
  },
  {
    title: "Scoped API tokens",
    text: "Mint unlimited rafiq_ tokens with per-token scopes, edit them live, revoke anytime. Your token is your MCP credential.",
  },
  {
    title: "Parity by construction",
    text: "MCP tools and REST routes call the same functions. Chat and UI read the same rows or the design is broken.",
  },
  {
    title: "Migrations, not magic",
    text: "Knex migrations version every schema change — expenses to transactions to accounts — replayable on any fresh Postgres.",
  },
  {
    title: "Zod at every boundary",
    text: "One schema validates input, describes the tool to the model, and shapes the docs. Single source, three jobs.",
  },
  {
    title: "One-process deploy",
    text: "Express serves UI, API, and MCP from one pm2 process behind nginx + TLS. SQLite fallback keeps local dev at zero setup.",
  },
];

const STACK = [
  "Node 20",
  "TypeScript",
  "MCP SDK",
  "Express",
  "Postgres",
  "Knex",
  "React 19",
  "Tailwind v4",
  "react-router",
  "pm2",
];

export default function Features() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <p className={eyebrow}>CAPABILITIES</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Small surface, finished edges.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="edge rounded-xl border border-hairline bg-surface-1 p-6">
              <p className="text-[15px] font-medium text-ink">{f.title}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="stack" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
        <p className={eyebrow}>STACK</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {STACK.map((s) => (
            <span
              key={s}
              className="rounded-md border border-hairline bg-surface-1 px-3 py-1.5 font-mono text-[13px] text-ink-muted"
            >
              {s}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
