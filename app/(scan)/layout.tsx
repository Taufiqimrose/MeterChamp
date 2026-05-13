// Auth gating happens in proxy.ts; this layout stays pure so the static
// shell can be served immediately.
export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-dvh flex-col bg-black">{children}</div>;
}
