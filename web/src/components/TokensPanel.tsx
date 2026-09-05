import { useCallback, useEffect, useState } from "react";
import { api, ALL_SCOPES, type TokenInfo } from "../api";
import { btnGhost, btnPrimary, card, eyebrow, input } from "../ui";

export default function TokensPanel() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...ALL_SCOPES]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadTokens = useCallback(() => {
    api
      .tokens()
      .then(setTokens)
      .catch((err: Error) => setMsg(err.message));
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  function toggleScope(s: string) {
    setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s]);
  }

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      setMsg(null);
      const t = await api.createToken(name, scopes);
      setFresh(t.token);
      setName("");
      loadTokens();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "create failed");
    }
  }

  return (
    <section className={`${card} mt-4 p-6`}>
      <p className={eyebrow}>API tokens · pick scopes per token</p>
      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
      {fresh && (
        <div className="mt-3 rounded-lg border border-brand/50 bg-canvas p-3">
          <p className="text-xs text-ink-subtle">Shown once — copy it now:</p>
          <p className="mt-1 break-all font-mono text-sm text-brand">{fresh}</p>
          <button
            onClick={() => void navigator.clipboard.writeText(fresh).then(() => setFresh(null))}
            className={`${btnGhost} mt-2`}
          >
            Copy & dismiss
          </button>
        </div>
      )}
      <form onSubmit={create} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className={input}
          placeholder="Token name (claude-code…)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Token name"
        />
        <button type="submit" className={btnPrimary}>
          Create
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {ALL_SCOPES.map((s) => (
          <label
            key={s}
            className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border px-3 text-xs ${
              scopes.includes(s) ? "border-brand text-ink" : "border-hairline text-ink-subtle"
            }`}
          >
            <input
              type="checkbox"
              className="accent-[#5e6ad2]"
              checked={scopes.includes(s)}
              onChange={() => toggleScope(s)}
            />
            {s.replace("entries:", "")}
          </label>
        ))}
      </div>
      <ul className="mt-2 divide-y divide-hairline">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {t.name || "(unnamed)"}{" "}
                <span className="font-mono text-xs text-ink-tertiary">#{t.id}</span>
              </p>
              <p className="truncate font-mono text-xs text-ink-subtle">
                {t.scopes.map((s) => s.replace("entries:", "")).join(" · ")}
              </p>
            </div>
            <button
              onClick={() =>
                api
                  .revokeToken(t.id)
                  .then(loadTokens)
                  .catch((err: Error) => setMsg(err.message))
              }
              className={btnGhost}
              aria-label={`Revoke token ${t.id}`}
            >
              Revoke
            </button>
          </li>
        ))}
        {tokens.length === 0 && (
          <p className="py-4 text-sm text-ink-subtle">No tokens yet.</p>
        )}
      </ul>
    </section>
  );
}
