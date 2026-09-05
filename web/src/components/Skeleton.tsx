export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 pb-16 sm:px-6" aria-label="Loading">
      <div className="pt-10 sm:pt-14">
        <div className="h-4 w-48 rounded bg-surface-2" />
        <div className="mt-3 h-12 w-72 max-w-full rounded-lg bg-surface-2" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-hairline bg-surface-1" />
        ))}
      </div>
      <div className="mt-4 h-64 rounded-xl border border-hairline bg-surface-1" />
      <div className="mt-4 h-96 rounded-xl border border-hairline bg-surface-1" />
    </div>
  );
}
