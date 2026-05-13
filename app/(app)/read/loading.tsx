// Mirrors ReadPicker's structure: header, dark hero, three type cards.
// Card count is fixed at 3 (water/electric/gas) which is what the real
// component always renders.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 pb-8" aria-busy>
      <header className="flex items-center gap-3 border-b border-neutral/15 px-4 py-3">
        <div className="size-10 animate-pulse rounded-full bg-neutral/15" />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-36 animate-pulse rounded-md bg-neutral/15" />
          <div className="h-3 w-24 animate-pulse rounded-md bg-neutral/15" />
        </div>
      </header>

      {/* Dark hero. Uses bg-ink (same as the real card) with white/10
          shimmers so the contrast feels right against the dark surface. */}
      <section className="mx-4 overflow-hidden rounded-3xl bg-ink">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-5">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-20 animate-pulse rounded-md bg-white/10" />
            <div className="mt-1 h-9 w-28 animate-pulse rounded-lg bg-white/10" />
            <div className="h-3 w-32 animate-pulse rounded-md bg-white/10" />
          </div>
          <div className="h-6 w-12 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="h-1.5 bg-white/10" />
      </section>

      <div className="flex flex-col gap-3 px-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral/10"
          >
            <div className="flex items-center gap-4">
              <div className="size-16 shrink-0 animate-pulse rounded-2xl bg-neutral/15" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-5 w-24 animate-pulse rounded-md bg-neutral/15" />
                <div className="h-3 w-32 animate-pulse rounded-md bg-neutral/15" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-1.5 w-full animate-pulse rounded-full bg-neutral/15" />
              <div className="h-3 w-16 animate-pulse rounded-md bg-neutral/15" />
            </div>
            <div className="h-14 animate-pulse rounded-2xl bg-neutral/15" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading meter types…</span>
    </div>
  );
}
