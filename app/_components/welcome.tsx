"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "motion/react";

const MotionLink = motion.create(Link);

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
  staggerChildren: 0.08,
  delayChildren: 0.05,
};

export function Welcome() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      transition={containerTransition}
      className="flex min-h-dvh w-full flex-col bg-cream px-8 pb-8 pt-28 text-ink"
    >
      <main className="flex flex-1 flex-col items-center text-center">
        <motion.div variants={fadeUp} transition={fadeUpTransition}>
          {/* Native asset is 156×79; rendering at h-20 (80px) is essentially
              1× — keeps the wordmark crisp on retina. priority because this
              is the splash LCP. */}
          <Image
            src="/logo.png"
            alt="Harmony Communities"
            width={156}
            height={79}
            priority
            className="h-20 w-auto"
          />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          transition={fadeUpTransition}
          className="mt-8 text-3xl font-extrabold uppercase tracking-wide"
        >
          Meters Made Easy
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={fadeUpTransition}
          className="mt-3 text-base font-bold text-neutral"
        >
          Read. Snap. Done.
        </motion.p>
      </main>

      <footer className="flex flex-col items-center gap-6">
        <MotionLink
          href="/login"
          variants={fadeUp}
          transition={fadeUpTransition}
          whileTap={{ scale: 0.98 }}
          className="w-full max-w-md rounded-2xl bg-primary py-4 text-center text-lg font-semibold text-ink shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover"
        >
          Get Started
        </MotionLink>

        <motion.div
          variants={fadeUp}
          transition={fadeUpTransition}
          className="flex flex-col items-center gap-1 text-xs text-neutral"
        >
          <span>© Harmony Communities Inc.</span>
          <span className="opacity-70">v1.0</span>
        </motion.div>
      </footer>
    </motion.div>
  );
}
