import { ALL_SCOPES } from "../api";

function shortLabel(scope: string) {
  const verb = scope.replace("entries:", "");
  return verb.charAt(0).toUpperCase() + verb.slice(1);
}

export default function ScopeChips({
  value,
  onToggle,
  onSelectAll,
  onClear,
}: {
  value: string[];
  onToggle: (scope: string) => void;
  onSelectAll?: () => void;
  onClear?: () => void;
}) {
  const allSelected = value.length === ALL_SCOPES.length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          Permissions{" "}
          <span className="ml-1 rounded-full border border-hairline px-2 py-0.5 font-mono text-[11px] text-ink-subtle">
            {value.length}/{ALL_SCOPES.length}
          </span>
        </p>
        <div className="flex shrink-0 gap-1 text-xs">
          {!allSelected ? (
            <button
              type="button"
              onClick={() => (onSelectAll ? onSelectAll() : ALL_SCOPES.forEach((s) => !value.includes(s) && onToggle(s)))}
              className="rounded-full px-2 py-1 text-ink-subtle hover:bg-surface-2 hover:text-ink"
            >
              Select all
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (onClear ? onClear() : ALL_SCOPES.forEach((s) => onToggle(s)))}
              className="rounded-full px-2 py-1 text-ink-subtle hover:bg-surface-2 hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_SCOPES.map((s) => {
          const active = value.includes(s);
          return (
            <button
              key={s}
              type="button"
              title={s}
              aria-pressed={active}
              onClick={() => onToggle(s)}
              className={`inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 text-[13px] transition-all duration-150 select-none active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-brand/50 ${
                active
                  ? "border-brand/60 bg-brand/[0.14] font-medium text-ink shadow-[0_0_0_1px_var(--color-brand)]"
                  : "border-hairline bg-canvas font-normal text-ink-subtle hover:border-hairline-strong hover:text-ink"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  active ? "bg-brand-hover" : "bg-ink-tertiary"
                }`}
              />
              {shortLabel(s)}
              {active && (
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="text-brand-hover"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {value.length === 0 && (
        <p className="mt-2 text-xs text-amber-200/80">
          No permissions selected — this token won't be able to do anything.
        </p>
      )}
    </div>
  );
}
