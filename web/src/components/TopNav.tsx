import { NavLink, useNavigate } from "react-router";
import logoUrl from "../assets/logo.svg";
import type { AuthUser, Period } from "../api";
import { btnGhost } from "../ui";
import { LogoutIcon } from "./icons";

const pill = "rounded-full px-3 py-1.5 text-sm";
const pillActive = `${pill} bg-surface-2 font-medium text-ink`;
const pillIdle = `${pill} text-ink-subtle hover:text-ink`;

export default function TopNav({
  period,
  setPeriod,
  onRefresh,
  user,
  onLogout,
}: {
  period?: Period;
  setPeriod?: (p: Period) => void;
  onRefresh?: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate("/dashboard")} aria-label="Dashboard">
            <img src={logoUrl} alt="Buddy logo" className="h-7 w-7 rounded-lg" />
          </button>
          <span className="hidden text-sm font-medium min-[420px]:inline">Buddy</span>
          <div className="hidden items-center gap-1 sm:flex">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? pillActive : pillIdle)}>
              Dashboard
            </NavLink>
            <NavLink to="/tokens" className={({ isActive }) => (isActive ? pillActive : pillIdle)}>
              Tokens
            </NavLink>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {setPeriod && period && (
            <div className="flex items-center gap-1 rounded-full border border-hairline bg-canvas p-1">
              {(["week", "month", "year"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={
                    period === p
                      ? "min-h-[32px] rounded-full bg-surface-2 px-3 text-sm font-medium text-ink"
                      : "min-h-[32px] rounded-full px-3 text-sm text-ink-subtle hover:text-ink"
                  }
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          )}
          {onRefresh && (
            <button onClick={onRefresh} className={btnGhost} title="Reload from server">
              <span aria-hidden>↻</span>
            </button>
          )}
          {user && (
            <>
              <span className="hidden rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink-muted md:inline">
                {user.username}
              </span>
              <button onClick={onLogout} className={`${btnGhost} text-lg`} title="Log out" aria-label="Log out">
                <LogoutIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
