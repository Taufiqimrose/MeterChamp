import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { KeyRound, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Forgot password",
};

const SUPPORT_EMAIL = "support@harmonydev.ai";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-cream px-7 pb-10 pt-16 text-ink">
      <main className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <KeyRound
          className="size-32 text-secondary"
          strokeWidth={2}
          aria-hidden
        />

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Forgot password?
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-neutral">
            Contact Harmony Communities to reset your password.
          </p>
        </div>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-3 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-ink shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover"
        >
          <Mail className="size-5" aria-hidden />
          {SUPPORT_EMAIL}
        </a>
      </main>

      <footer className="flex flex-col items-center gap-6">
        <Link
          href="/login"
          className="text-base font-medium text-secondary underline underline-offset-4 hover:text-secondary-hover"
        >
          Back to sign in
        </Link>
        <Image
          src="/logo.png"
          alt="Harmony Communities"
          width={156}
          height={79}
          className="h-7 w-auto opacity-60"
        />
      </footer>
    </div>
  );
}
