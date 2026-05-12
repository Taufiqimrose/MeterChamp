"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const container: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
  },
};

const fadeUpTransition = {
  type: "spring" as const,
  stiffness: 220,
  damping: 24,
};

const containerTransition = {
  staggerChildren: 0.06,
  delayChildren: 0.05,
};

function getInputValue(event: ChangeEvent<HTMLInputElement>) {
  return (event.currentTarget as EventTarget & { value: string }).value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <motion.form
      variants={container}
      initial="hidden"
      animate="visible"
      transition={containerTransition}
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6"
      noValidate
    >
      <motion.div
        variants={fadeUp}
        transition={fadeUpTransition}
        className="flex flex-col gap-2"
      >
        <label
          htmlFor="email"
          className="text-base font-semibold text-ink"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@harmonycom.com"
          value={email}
          onChange={(e) => setEmail(getInputValue(e))}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-base text-ink placeholder:text-neutral/70 shadow-sm outline-none transition focus:border-secondary focus:ring-4 focus:ring-secondary/15"
        />
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={fadeUpTransition}
        className="flex flex-col gap-2"
      >
        <label
          htmlFor="password"
          className="text-base font-semibold text-ink"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(getInputValue(e))}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 pr-14 text-base text-ink placeholder:text-neutral/70 shadow-sm outline-none transition focus:border-secondary focus:ring-4 focus:ring-secondary/15"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-neutral transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            {showPassword ? (
              <EyeOff className="size-5" aria-hidden />
            ) : (
              <Eye className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        transition={fadeUpTransition}
        className="flex items-center justify-between"
      >
        <span className="text-base font-medium text-ink">
          Stay signed in
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={staySignedIn}
          aria-label="Stay signed in"
          onClick={() => setStaySignedIn((v) => !v)}
          className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover ${
            staySignedIn ? "bg-primary" : "bg-neutral/40"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className={`absolute top-1 size-5 rounded-full bg-white shadow ${
              staySignedIn ? "right-1" : "left-1"
            }`}
          />
        </button>
      </motion.div>

      {error ? (
        <motion.p
          variants={fadeUp}
          transition={fadeUpTransition}
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
        >
          {error}
        </motion.p>
      ) : null}

      <motion.button
        variants={fadeUp}
        transition={fadeUpTransition}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={isPending}
        className="mt-2 w-full rounded-2xl bg-primary py-4 text-lg font-semibold text-ink shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Signing in…" : "Sign In"}
      </motion.button>
    </motion.form>
  );
}
