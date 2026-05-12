import type { Metadata } from "next";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { LoginForm } from "@/app/_components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-cream px-7 pb-10 pt-12 text-ink">
      <Gauge
        className="size-10 text-secondary"
        strokeWidth={2.25}
        aria-hidden
      />

      <header className="mt-6 flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="text-base text-neutral">
          Sign in to continue your readings
        </p>
      </header>

      <div className="mt-10 flex flex-1 flex-col">
        <LoginForm />

        <div className="mt-auto flex justify-center pt-12">
          <Link
            href="/forgot-password"
            className="text-base font-medium text-secondary underline underline-offset-4 hover:text-secondary-hover"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
