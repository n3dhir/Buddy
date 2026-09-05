import { useEffect } from "react";
import LogForm from "./LogForm";
import { btnGhost } from "../ui";
import { XIcon } from "./icons";

export default function EntryModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
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

  return (
    <div
      className="fixed inset-0 z-20 overflow-y-auto bg-black/70"
      onClick={onClose}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="edge w-full max-w-md rounded-t-2xl border border-hairline bg-surface-1 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-xl"
        >
        <div className="flex justify-end">
          <button onClick={onClose} className={btnGhost} aria-label="Close">
            <XIcon />
          </button>
        </div>
        <div className="mt-1">
          <LogForm
            plain
            onDone={() => {
              onClose();
              onDone();
            }}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
