import { NavLink } from "react-router";
import { PlusIcon } from "./icons";

export default function BottomBar({ onNew }: { onNew: () => void }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 items-center justify-center py-3 text-sm ${
      isActive ? "font-medium text-ink" : "text-ink-subtle"
    }`;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-canvas/95 backdrop-blur sm:hidden">
      <div className="flex items-stretch">
        <NavLink to="/dashboard" className={tab}>
          Dashboard
        </NavLink>
        <button
          onClick={onNew}
          aria-label="Log new entry"
          className="mx-2 my-1.5 flex min-h-[44px] min-w-[64px] items-center justify-center rounded-xl bg-brand text-xl text-white"
        >
          <PlusIcon />
        </button>
        <NavLink to="/tokens" className={tab}>
          Tokens
        </NavLink>
      </div>
    </nav>
  );
}
