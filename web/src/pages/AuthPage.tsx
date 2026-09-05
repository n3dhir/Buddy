import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { api, getToken, setSession } from "../api";
import logoUrl from "../assets/logo.svg";
import { btnPrimary, card, eyebrow, input } from "../ui";

const POINTS = [
  ["chat-native", "Log expenses from Claude, review them here. One core, two doors."],
  ["scoped tokens", "Mint rafiq_ tokens with exactly the permissions each client needs."],
  ["Tunis-time correct", "Dates, stamps, and summaries on Africa/Tunis — midnight included."],
];

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (getToken()) return <Navigate to="/dashboard" replace />;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      setMsg(null);
      const { token, user } =
        mode === "login"
          ? await api.login(username, password)
          : await api.register(username, password);
      setSession(token, user);
      setUsername("");
      setPassword("");
      navigate("/dashboard");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "auth failed");
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto grid min-h-screen max-w-6xl min-[700px]:grid-cols-2">
        {/* Brand panel */}
        <div className="flex flex-col justify-center gap-8 px-4 pb-4 pt-6 sm:px-6 min-[700px]:gap-12 min-[700px]:pb-8 min-[700px]:pt-8 lg:py-12">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Rafiq logo" className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-medium text-ink">Rafiq</span>
          </Link>
          <div className="rise mt-8 md:mt-0">
            <p className={eyebrow}>
              {mode === "login" ? "WELCOME BACK" : "JOIN RAFIQ"}
            </p>
            <h1 className="mt-3 max-w-md text-[28px] font-semibold tracking-tight text-ink min-[700px]:text-4xl xl:text-5xl">
              {mode === "login" ? "Pick up where your money left off." : "Your money, chat-native in minutes."}
            </h1>
            <ul className="mt-5 hidden space-y-4 min-[700px]:mt-8 min-[700px]:block">
              {POINTS.map(([title, text]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <div>
                    <p className="font-mono text-[13px] text-ink">{title}</p>
                    <p className="mt-0.5 max-w-sm text-sm leading-relaxed text-ink-subtle">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-10 hidden font-mono text-xs text-ink-tertiary lg:block">
            Tunis time (UTC+1) · Postgres underneath
          </p>
        </div>

        {/* Form panel */}
        <div className="flex items-start justify-center px-4 pb-16 pt-6 sm:px-6 min-[700px]:items-center min-[700px]:pb-12 min-[700px]:pt-8">
          <form onSubmit={submit} className={`${card} rise w-full max-w-sm p-6 sm:p-8`} style={{ animationDelay: "80ms" }}>
            <p className={eyebrow}>{mode === "login" ? "LOG IN" : "CREATE ACCOUNT"}</p>
            <h2 className="mt-2 text-[22px] font-medium tracking-tight text-ink">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <div className="mt-5 space-y-2.5">
              <div>
                <label htmlFor="auth-username" className="mb-1.5 block text-sm text-ink-muted">
                  Username
                </label>
                <input
                  id="auth-username"
                  className={input}
                  placeholder="e.g. nour"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-sm text-ink-muted">
                  Password
                </label>
                <input
                  id="auth-password"
                  className={input}
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>
            {msg && (
              <p className="mt-3 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
                {msg}
              </p>
            )}
            <button type="submit" className={`${btnPrimary} mt-4 w-full`}>
              {mode === "login" ? "Log in" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => navigate(mode === "login" ? "/register" : "/login")}
              className="mt-2 w-full text-center text-sm text-ink-subtle hover:text-ink"
            >
              {mode === "login" ? "No account? Register" : "Have an account? Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
