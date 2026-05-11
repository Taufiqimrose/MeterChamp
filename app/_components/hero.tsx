"use client";

import { motion } from "motion/react";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 220, damping: 22 },
  },
};

export function Hero() {
  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center gap-8 text-center sm:items-start sm:text-left"
    >
      <motion.span
        variants={item}
        className="inline-flex items-center rounded-full border border-black/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-700 dark:border-white/20 dark:text-zinc-300"
      >
        Next.js 16 · PWA · Motion
      </motion.span>

      <motion.h1
        variants={item}
        className="text-balance text-4xl font-semibold leading-tight tracking-tight text-black sm:text-5xl dark:text-zinc-50"
      >
        Meter Made Easy
      </motion.h1>

      <motion.p
        variants={item}
        className="max-w-md text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-400"
      >
        Scaffold ready. Tailwind v4, Motion animations, and an offline-ready
        service worker via Serwist.
      </motion.p>

      <motion.div
        variants={item}
        className="flex flex-col gap-3 text-base font-medium sm:flex-row"
      >
        <motion.a
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          href="https://nextjs.org/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Next.js docs
        </motion.a>
        <motion.a
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          href="https://motion.dev/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center rounded-full border border-black/10 px-6 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          Motion docs
        </motion.a>
      </motion.div>
    </motion.section>
  );
}
