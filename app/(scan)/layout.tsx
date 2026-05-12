import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  return <div className="flex min-h-dvh flex-col bg-black">{children}</div>;
}
