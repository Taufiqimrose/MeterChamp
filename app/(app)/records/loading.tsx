export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pb-8" aria-busy>
      <header className="border-b border-neutral/15 px-4 py-3">
        <div className="h-5 w-24 animate-pulse rounded-md bg-neutral/15" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded-md bg-neutral/15" />
      </header>

      <div className="flex flex-col gap-3 px-4">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-full bg-neutral/15"
            />
          ))}
        </div>
        <div className="flex gap-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-6 w-20 animate-pulse rounded-full bg-neutral/15"
            />
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-2 px-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="flex items-center gap-4 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-neutral/10"
          >
            <div className="size-12 shrink-0 animate-pulse rounded-2xl bg-neutral/15" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-40 animate-pulse rounded-md bg-neutral/15" />
              <div className="h-3 w-20 animate-pulse rounded-md bg-neutral/15" />
            </div>
            <div className="h-6 w-16 animate-pulse rounded-full bg-neutral/15" />
          </li>
        ))}
      </ul>

      <span className="sr-only">Loading records…</span>
    </div>
  );
}
