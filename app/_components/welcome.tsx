"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Gauge } from "lucide-react";

const MotionLink = motion.create(Link);

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 220, damping: 24 },
  },
};

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export function Welcome() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="flex min-h-dvh w-full flex-col bg-cream px-8 pb-8 pt-28 text-ink"
    >
      <main className="flex flex-1 flex-col items-center text-center">
        <motion.div variants={fadeUp} aria-hidden>
          <Gauge
            className="size-24 text-secondary"
            strokeWidth={2.25}
          />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mt-10 text-3xl font-extrabold uppercase tracking-wide"
        >
          Meters Made Easy
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-3 text-base font-bold text-neutral"
        >
          Read. Snap. Done.
        </motion.p>
      </main>

      <footer className="flex flex-col items-center gap-6">
        <MotionLink
          href="/login"
          variants={fadeUp}
          whileTap={{ scale: 0.98 }}
          className="w-full max-w-md rounded-2xl bg-primary py-4 text-center text-lg font-semibold text-ink shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover"
        >
          Get Started
        </MotionLink>

        <motion.div
          variants={fadeUp}
          className="flex flex-col items-center gap-1 text-xs text-neutral"
        >
          <span>Created by Harmony Com AI Team</span>
          <span className="opacity-70">v1.0</span>
        </motion.div>
      </footer>
    </motion.div>
  );
}
