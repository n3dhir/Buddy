import { useCallback, useEffect, useState } from "react";
import { api, type TokenInfo } from "../api";
import { btnGhost, card, eyebrow } from "../ui";
import { ChevronIcon, CopyIcon } from "./icons";
import EmptyState from "./EmptyState";
import TokenDialog from "./TokenDialog";

export default function TokensPanel() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<TokenInfo | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadTokens = useCallback(() => {
    api
      .tokens()
      .then(setTokens)
      .catch((err: Error) => setMsg(err.message));
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  return (
    <section className={`${card} mt-4 p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-2">
        <p className={eyebrow}>API tokens · pick scopes per token</p>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-subtle hover:text-ink"
        >
          + New
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
      {fresh && (
        <div className="mt-3 rounded-lg border border-brand/50 bg-canvas p-3">
          <p className="text-xs text-ink-subtle">Shown once — copy it now:</p>
          <p className="mt-1 break-all font-mono text-sm text-brand">{fresh}</p>
          <button
            onClick={() => void navigator.clipboard.writeText(fresh).then(() => setFresh(null))}
            className={`${btnGhost} mt-2 gap-1.5`}
          >
            <CopyIcon /> Copy & dismiss
          </button>
        </div>
      )}
      <ul className="mt-1 divide-y divide-hairline">
        {tokens.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => setSelected(t)}
              className="group flex w-full items-center gap-3 py-3.5 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs text-brand">
                {t.name ? t.name.slice(0, 2).toUpperCase() : `#${t.id}`}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-ink">
                  {t.name || "(unnamed)"}{" "}
                  <span className="font-mono text-xs text-ink-tertiary">#{t.id}</span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-ink-subtle">
                  {t.scopes.map((s) => s.replace("entries:", "")).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-ink-tertiary group-hover:text-ink">
                <ChevronIcon />
              </span>
            </button>
          </li>
        ))}
        {tokens.length === 0 && (
          <div className="py-4">
            <EmptyState title="No tokens yet" hint="Create one to connect chat or scripts." />
          </div>
        )}
      </ul>
      {selected && (
        <TokenDialog
          key={selected.id}
          token={selected}
          onClose={() => setSelected(null)}
          onChanged={loadTokens}
        />
      )}
      {showCreate && (
        <TokenDialog
          token={null}
          onClose={() => setShowCreate(false)}
          onChanged={loadTokens}
          onCreated={setFresh}
        />
      )}
    </section>
  );
}
