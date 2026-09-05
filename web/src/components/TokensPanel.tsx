import { useCallback, useEffect, useState } from "react";
import { api, ALL_SCOPES, type TokenInfo } from "../api";
import EmptyState from "./EmptyState";
import { toast } from "./Toaster";
import { btnGhost, btnPrimary, card, eyebrow, input } from "../ui";

export default function TokensPanel() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...ALL_SCOPES]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editScopes, setEditScopes] = useState<string[]>([]);

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

  async function saveScopes(id: number) {
    try {
      setMsg(null);
      await api.updateToken(id, { scopes: editScopes });
      setEditingId(null);
      toast("Token scopes updated");
      loadTokens();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "save failed");
    }
  }

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      setMsg(null);
      const t = await api.createToken(name, scopes);
      setFresh(t.token);
      setName("");
      toast("Token created — copy it now");
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
          <li key={t.id} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">
                  {t.name || "(unnamed)"}{" "}
                  <span className="font-mono text-xs text-ink-tertiary">#{t.id}</span>
                </p>
                <p className="truncate font-mono text-xs text-ink-subtle">
                  {t.scopes.map((s) => s.replace("entries:", "")).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => {
                    setEditingId(editingId === t.id ? null : t.id);
                    setEditScopes(t.scopes);
                  }}
                  className={btnGhost}
                  aria-label={`Edit scopes for token ${t.id}`}
                >
                  {editingId === t.id ? "Close" : "Scopes"}
                </button>
              <button
                onClick={() =>
                  api
                    .revokeToken(t.id)
                    .then(() => {
                      toast("Token revoked");
                      loadTokens();
                    })
                    .catch((err: Error) => setMsg(err.message))
                }
                  className={btnGhost}
                  aria-label={`Revoke token ${t.id}`}
                >
                  Revoke
                </button>
              </div>
            </div>
            {editingId === t.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-3">
                {ALL_SCOPES.map((s) => (
                  <label
                    key={s}
                    className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3 text-xs ${
                      editScopes.includes(s) ? "border-brand text-ink" : "border-hairline text-ink-subtle"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#5e6ad2]"
                      checked={editScopes.includes(s)}
                      onChange={() =>
                        setEditScopes(
                          editScopes.includes(s)
                            ? editScopes.filter((x) => x !== s)
                            : [...editScopes, s],
                        )
                      }
                    />
                    {s.replace("entries:", "")}
                  </label>
                ))}
                <button onClick={() => void saveScopes(t.id)} className={btnPrimary}>
                  Save
                </button>
              </div>
            )}
          </li>
        ))}
        {tokens.length === 0 && (
          <div className="py-4">
            <EmptyState title="No tokens yet" hint="Create one above to connect chat or scripts." />
          </div>
        )}
      </ul>
    </section>
  );
}
