import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getToken, getUser, setSession, type AuthUser } from "../api";
import { eyebrow } from "../ui";
import BottomBar from "../components/BottomBar";
import ConfirmDialog from "../components/ConfirmDialog";
import Toaster from "../components/Toaster";
import TokensPanel from "../components/TokensPanel";
import TopNav from "../components/TopNav";

export default function Tokens() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const [confirmLogout, setConfirmLogout] = useState(false);
  const navigate = useNavigate();

  function logout() {
    setSession(null, null);
    setUser(null);
    setConfirmLogout(false);
    navigate("/login");
  }

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }
    setReady(true);
  }, [navigate]);

  if (!ready) {
    return <div className="min-h-screen bg-canvas" />;
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <TopNav user={user} onLogout={() => setConfirmLogout(true)} />
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 sm:pb-16">
        <header className="rise pt-10 sm:pt-14">
          <p className={eyebrow}>MACHINE ACCESS</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Tokens
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Mint unlimited tokens with exactly the scopes each client needs.
            Shown once — edit scopes or revoke anytime. Your token is your MCP credential.
          </p>
        </header>
        <div className="rise mt-8" style={{ animationDelay: "80ms" }}>
          <TokensPanel />
        </div>
        <footer className="mt-12 border-t border-hairline pt-6 text-xs text-ink-tertiary">
          Tokens authorize machines; your password stays yours.
        </footer>
      </main>
      <div className="sm:hidden">
        <BottomBar onNew={() => navigate("/dashboard", { state: { fresh: true } })} />
      </div>
      {confirmLogout && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need your password to log back in."
          confirmLabel="Log out"
          onClose={() => setConfirmLogout(false)}
          onConfirm={logout}
        />
      )}
      <Toaster />
    </div>
  );
}
