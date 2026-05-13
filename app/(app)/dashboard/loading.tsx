// Sizes here intentionally mirror dashboard/page.tsx so that when the real
// content arrives, nothing reflows — the spinner just dissolves into the
// final layout.
export default function Loading() {
  return (
    <div className="flex flex-col" aria-busy>
      <header className="flex items-center justify-between border-b border-neutral/15 px-6 py-4">
        <div className="h-5 w-24 animate-pulse rounded-md bg-neutral/15" />
        <div className="size-10 animate-pulse rounded-full bg-neutral/15" />
      </header>

      <main className="flex flex-col items-center gap-8 px-6 py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="h-3 w-28 animate-pulse rounded-md bg-neutral/15" />
          <div className="mt-1 h-9 w-56 animate-pulse rounded-lg bg-neutral/15" />
        </div>

        {/* Progress ring stand-in: same 240px outer + 14px stroke as
            ProgressRing so the ring doesn't visually pop in. */}
        <div className="relative flex size-60 items-center justify-center">
          <div
            className="size-full animate-pulse rounded-full border-[14px] border-neutral/15"
            aria-hidden
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
            <div className="h-14 w-24 animate-pulse rounded-lg bg-neutral/15" />
            <div className="h-4 w-16 animate-pulse rounded-md bg-neutral/15" />
            <div className="h-3 w-24 animate-pulse rounded-md bg-neutral/15" />
          </div>
        </div>

        <div className="h-4 w-64 animate-pulse rounded-md bg-neutral/15" />

        <div className="h-14 w-full animate-pulse rounded-2xl bg-neutral/15" />

        <div className="grid w-full grid-cols-2 gap-3">
          <div className="h-11 animate-pulse rounded-2xl bg-neutral/15" />
          <div className="h-11 animate-pulse rounded-2xl bg-neutral/15" />
        </div>
      </main>

      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
