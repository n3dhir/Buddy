import { Link } from "react-router";

const eyebrow = "text-[13px] font-medium tracking-[0.4px] text-ink-subtle";

const STATS: [string, string][] = [
  ["7", "MCP tools"],
  ["3", "front doors"],
  ["1", "Postgres"],
];

export default function Hero() {
  return (
    <header className="rise mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
      <p className={eyebrow}>PERSONAL FINANCE INFRASTRUCTURE</p>
      <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-7xl">
        Personal finance, chat-native.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
        Rafiq tracks expenses two ways — a React web app and an MCP server your
        AI assistant calls mid-conversation — on one TypeScript core over
        Postgres. Same functions, same validation, same data.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/register"
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Try the live app
        </Link>
        <a
          href="#architecture"
          className="rounded-lg border border-hairline bg-surface-1 px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-2"
        >
          See how it&apos;s built
        </a>
      </div>
      <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
        {STATS.map(([n, label]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="sr-only">{label}</dt>
            <dd className="font-mono text-2xl text-ink">{n}</dd>
            <dd className="text-sm text-ink-subtle">{label}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
