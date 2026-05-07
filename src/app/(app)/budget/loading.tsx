export default function Loading() {
  return (
    <main className="pb-8">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-1 h-4 w-24 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* BudgetWidget skeleton */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-28 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="mb-2 h-4 w-full animate-pulse rounded-full bg-gray-200" />
        <div className="flex justify-between">
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      {/* Stats grid — 4 cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <div className="mx-auto mb-1 h-6 w-16 animate-pulse rounded bg-gray-200" />
            <div className="mx-auto h-3 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* ManualTransactionForm skeleton */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Transaction list — 5 rows */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-4 py-3 ${
              i !== 4 ? 'border-b border-gray-100' : ''
            }`}
          >
            <div className="flex flex-col gap-1">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </main>
  );
}
