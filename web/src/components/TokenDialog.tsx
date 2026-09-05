import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, ALL_SCOPES, type TokenInfo } from "../api";
import { btnGhost, btnPrimary, input } from "../ui";
import { CopyIcon, TrashIcon, XIcon } from "./icons";
import { toast } from "./Toaster";
import ScopeChips from "./ScopeChips";

export default function TokenDialog({
  token,
  onClose,
  onChanged,
  onCreated,
}: {
  token: TokenInfo | null;
  onClose: () => void;
  onChanged: () => void;
  onCreated?: (fresh: string) => void;
}) {
  const isCreate = token === null;
  const [name, setName] = useState(token?.name ?? "");
  const [scopes, setScopes] = useState<string[]>(token?.scopes ?? [...ALL_SCOPES]);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function toggleScope(s: string) {
    setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s]);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      setMsg(null);
      if (token) {
        await api.updateToken(token.id, { name, scopes });
        toast("Token updated");
        onChanged();
        onClose();
      } else {
        const t = await api.createToken(name, scopes);
        setFresh(t.token);
        toast("Token created — copy it now");
        onChanged();
        onCreated?.(t.token);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "save failed");
    }
  }

  async function revoke() {
    if (!token) return;
    try {
      await api.revokeToken(token.id);
      toast("Token revoked");
      onChanged();
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "revoke failed");
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-20 overflow-y-auto bg-black/70"
      onClick={onClose}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal
          aria-label={token ? `Token ${token.name || token.id}` : "New token"}
          className="edge w-full max-w-md rounded-t-2xl border border-hairline bg-surface-1 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-xl sm:p-6"
        >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs text-brand">
              {token
                ? token.name
                  ? token.name.slice(0, 2).toUpperCase()
                  : `#${token.id}`
                : "+"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-ink">
                {token ? token.name || "(unnamed)" : "New token"}
              </p>
              <p className="font-mono text-xs text-ink-tertiary">
                {token ? `#${token.id} · ${token.created_at}` : "Shown once — copy it now"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {token && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                title="Revoke token"
                aria-label="Revoke token"
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg px-2.5 text-sm text-ink-tertiary hover:bg-red-500/10 hover:text-red-400"
              >
                <TrashIcon />
              </button>
            )}
            <button onClick={onClose} className={`${btnGhost} shrink-0`} aria-label="Close">
              <XIcon />
            </button>
          </div>
        </div>
        {confirming && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
            <p className="text-sm leading-relaxed text-ink">
              Revoke this token? <span className="text-ink-subtle">Clients using it stop working immediately.</span>
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirming(false)} className={`${btnGhost} flex-1 justify-center border border-hairline`}>
                Keep
              </button>
              <button
                onClick={() => void revoke()}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                <TrashIcon /> Revoke
              </button>
            </div>
          </div>
        )}
        {fresh ? (
          <div className="mt-4 rounded-xl border border-brand/50 bg-canvas p-3">
            <p className="text-xs text-ink-subtle">Shown once — copy it now:</p>
            <p className="mt-1 break-all font-mono text-sm text-brand">{fresh}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void navigator.clipboard.writeText(fresh).then(() => toast("Copied"))}
                className={`${btnGhost} flex-1 justify-center gap-1.5 border border-hairline`}
              >
                <CopyIcon /> Copy
              </button>
              <button onClick={onClose} className={`${btnPrimary} flex-1`}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="mt-4">
            <label htmlFor="token-name" className="mb-1.5 block text-sm text-ink-muted">
              Name
            </label>
            <input
              id="token-name"
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Token name (claude-code…)"
              maxLength={64}
              autoFocus={isCreate}
            />
            <div className="mt-4">
              <ScopeChips value={scopes} onToggle={toggleScope} />
            </div>
            {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
            <button type="submit" className={`${btnPrimary} mt-4 w-full`}>
              {isCreate ? "Create token" : "Save changes"}
            </button>
          </form>
        )}
        <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-ink-tertiary">
          <CopyIcon /> secret shown only once, at creation
        </p>
      </div>
      </div>
    </div>,
    document.body
  );
}
