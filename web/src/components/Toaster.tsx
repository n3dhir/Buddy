import { useEffect, useState } from "react";

let push: ((msg: string) => void) | null = null;

export function toast(msg: string) {
  push?.(msg);
}

export default function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);

  useEffect(() => {
    push = (msg) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, msg }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2600);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <p
          key={t.id}
          role="status"
          className="w-auto rounded-lg border border-hairline bg-surface-2 px-4 py-2 text-center text-sm text-ink shadow-xl"
        >
          {t.msg}
        </p>
      ))}
    </div>
  );
}
