export default function Loading() {
  return (
    <main className="mx-auto max-w-[480px] px-5 py-8">
      {/* PageHeader skeleton */}
      <div className="mb-6">
        <div className="mb-1 h-3 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Summary cards — 3 cols */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 h-3 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-7 w-3/4 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Top products bar chart area */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
              <div
                className="h-4 animate-pulse rounded-full bg-gray-200"
                style={{ width: `${70 - i * 12}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Category pie / donut chart area */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-4 h-5 w-44 animate-pulse rounded bg-gray-200" />
        <div className="flex items-center gap-6">
          <div className="h-36 w-36 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-gray-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
