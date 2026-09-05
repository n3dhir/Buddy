export default function Screenshot() {
  return (
    <section id="product" className="rise mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24" style={{ animationDelay: "120ms" }}>
      <div className="edge rounded-2xl border border-hairline bg-surface-1 p-3 sm:p-6">
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" aria-hidden />
          <span className="ml-2 font-mono text-xs text-ink-tertiary">rafiq — dashboard</span>
        </div>
        <img
          src="/shot-dashboard.png"
          alt="Rafiq dashboard: monthly summary, spending by category, and entries"
          className="w-full rounded-xl border border-hairline"
          loading="lazy"
        />
      </div>
    </section>
  );
}
