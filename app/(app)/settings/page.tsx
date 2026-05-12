import type { Metadata } from "next";
import { Settings as SettingsIcon, LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
      <div className="flex size-24 items-center justify-center rounded-3xl bg-secondary/10 text-secondary">
        <SettingsIcon className="size-12" strokeWidth={2} aria-hidden />
      </div>

      <div className="flex max-w-xs flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Settings
        </h1>
        <p className="text-base leading-relaxed text-neutral">
          Account, preferences, and app configuration will appear here.
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral/70">
          Coming soon
        </p>
      </div>

      <form action={signOut} className="w-full max-w-xs">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-secondary bg-white py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/5"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}
