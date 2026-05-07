export default function Loading() {
  return (
    <main className="mx-auto max-w-[480px] px-5 py-8 pb-32">
      {/* PageHeader skeleton */}
      <div className="mb-6">
        <div className="mb-1 h-3 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-44 animate-pulse rounded-lg bg-gray-200" />
      </div>

      <div className="space-y-8">
        {/* Category group 1 — 3 items */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-4 ${
                  i !== 2 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-12 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Category group 2 — 2 items */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-4 ${
                  i !== 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="h-4 w-14 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-10 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Total card */}
        <div className="rounded-xl bg-gray-200 p-6 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 rounded bg-gray-300" />
            <div className="h-7 w-20 rounded bg-gray-300" />
          </div>
        </div>
      </div>
    </main>
  );
}
