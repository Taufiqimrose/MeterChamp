import { BottomNav } from "@/app/_components/bottom-nav";

// Auth gating lives in proxy.ts (edge middleware) so this layout stays a
// pure server component with no cookie/header dependency. That lets Next
// statically pre-render placeholder routes under (app) — tabs that show
// no live data (messages, settings) become instant
// because there is no per-click server work.
//
// Data-bearing pages (dashboard, read) still call getUser() in their own
// loaders, so user identity is still verified where it actually matters.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav />
    </div>
  );
}
