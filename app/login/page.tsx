import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/app/_components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-cream px-7 pb-10 pt-12 text-ink">
      <Image
        src="/logo.png"
        alt="Harmony Communities"
        width={156}
        height={79}
        priority
        className="h-10 w-auto self-start"
      />

      <header className="mt-8 flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="text-base text-neutral">
          Sign in to continue your readings
        </p>
      </header>

      <div className="mt-10 flex flex-1 flex-col">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

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
