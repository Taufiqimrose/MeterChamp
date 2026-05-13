export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-black">
      <div
        className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-primary"
        aria-hidden
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
