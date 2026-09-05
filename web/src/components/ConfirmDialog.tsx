import { useEffect } from "react";
import { btnGhost, card, eyebrow } from "../ui";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
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
      className="fixed inset-0 z-30 overflow-y-auto bg-black/70"
      onClick={onClose}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal
          aria-label={title}
          className={`${card} w-full max-w-sm p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]`}
        >
        <p className={eyebrow}>PLEASE CONFIRM</p>
        <p className="mt-2 text-lg font-medium text-ink">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">{message}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className={`${btnGhost} flex-1 justify-center border border-hairline`}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
