import { Link } from "react-router";
import logoUrl from "../../assets/logo.svg";

export default function Closing() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
        <div className="edge rounded-xl border border-hairline bg-surface-1 p-8 sm:p-12">
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink sm:text-[28px] sm:leading-[1.2]">
            Log an expense from chat tonight. See it in the dashboard tomorrow.
          </h2>
          <div className="mt-6">
            <Link
              to="/register"
              className="inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Try the live app
            </Link>
          </div>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Buddy logo" className="h-6 w-6 rounded-md" />
            <span className="text-sm text-ink-subtle">Buddy · personal finance infrastructure</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-ink-subtle">
            <Link to="/dashboard" className="hover:text-ink">Live app</Link>
            <Link to="/login" className="hover:text-ink">Log in</Link>
            <span className="font-mono text-xs text-ink-tertiary">Tunis time (UTC+1)</span>
          </div>
        </div>
      </footer>
    </>
  );
}
