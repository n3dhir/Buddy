import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { api, getToken, setSession } from "../api";
import { btnPrimary, card, eyebrow, input } from "../ui";

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm p-6`}>
        <p className={eyebrow}>{mode === "login" ? "Welcome back" : "Create account"}</p>
        <div className="mt-3 space-y-2">
          <input
            className={input}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
          <input
            className={input}
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
        <button type="submit" className={`${btnPrimary} mt-3 w-full`}>
          {mode === "login" ? "Log in" : "Register"}
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
  );
}
