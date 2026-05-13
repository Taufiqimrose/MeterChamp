// Shown by the Next.js router instantly when a tap navigates to any (app)
// route that is still loading. Because BottomNav lives in the layout, it
// stays visible — only the content slot shows this fallback, so the tap
// reads as "navigation happened" rather than "the app froze".
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div
        className="size-10 animate-spin rounded-full border-2 border-neutral/20 border-t-primary"
        aria-hidden
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
