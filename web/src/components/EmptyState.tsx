export default function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-6 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-subtle">{hint}</p>}
    </div>
  );
}
