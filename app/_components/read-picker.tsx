"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  Droplets,
  Flame,
  MapPin,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MotionLink = motion.create(Link);
import type { ReadingProgress } from "@/lib/data/reading";
import type { MeterType } from "@/lib/data/units";

type CardSpec = {
  type: MeterType;
  label: string;
  unitLabel: string;
  icon: LucideIcon;
  /** Solid background for the icon chip and progress fill. */
  accent: string;
  /** Light wash used as the card surface when this card is the highlight. */
  surface: string;
  /** Foreground for the icon when on the accent background. */
  onAccent: string;
};

const CARDS: CardSpec[] = [
  {
    type: "water",
    label: "Water",
    unitLabel: "gallons",
    icon: Droplets,
    accent: "bg-blue-500",
    surface: "bg-blue-50",
    onAccent: "text-white",
  },
  {
    type: "electric",
    label: "Electric",
    unitLabel: "kilowatt-hours",
    icon: Zap,
    accent: "bg-primary",
    surface: "bg-primary/10",
    onAccent: "text-ink",
  },
  {
    type: "gas",
    label: "Gas",
    unitLabel: "hundred cubic feet",
    icon: Flame,
    accent: "bg-rose-500",
    surface: "bg-rose-50",
    onAccent: "text-white",
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const stagger = { staggerChildren: 0.07, delayChildren: 0.04 };
const spring = { type: "spring" as const, stiffness: 220, damping: 24 };

export function ReadPicker({ progress }: { progress: ReadingProgress }) {
  const totals = Object.values(progress.byType).reduce(
    (acc, p) => {
      acc.total += p.total;
      acc.read += p.read;
      return acc;
    },
    { total: 0, read: 0 },
  );
  const overallPct =
    totals.total > 0 ? Math.round((totals.read / totals.total) * 100) : 0;
  const allDone = totals.total > 0 && totals.read === totals.total;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      transition={stagger}
      className="flex flex-col gap-6 pb-8"
    >
      {/* Header */}
      <motion.header
        variants={item}
        transition={spring}
        className="flex items-center gap-3 border-b border-neutral/15 px-4 py-3"
      >
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="flex size-10 items-center justify-center rounded-full text-neutral transition-colors hover:bg-secondary/10 hover:text-ink"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink">Pick meter type</h1>
          <p className="inline-flex items-center gap-1 text-xs text-neutral">
            <MapPin className="size-3" aria-hidden /> {progress.parkName}
          </p>
        </div>
      </motion.header>

      {/* Overall progress hero */}
      <motion.section
        variants={item}
        transition={spring}
        className="mx-4 overflow-hidden rounded-3xl bg-ink text-cream"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/60">
              This cycle
            </p>
            <p className="mt-1 text-4xl font-extrabold leading-none">
              {totals.read}
              <span className="ml-1 text-xl font-bold text-cream/60">
                / {totals.total}
              </span>
            </p>
            <p className="mt-1 text-sm text-cream/70">meters captured</p>
          </div>
          {allDone ? (
            <CheckCircle2 className="size-10 text-primary" aria-hidden />
          ) : (
            <span className="rounded-full bg-cream/10 px-3 py-1 text-xs font-semibold text-cream">
              {overallPct}%
            </span>
          )}
        </div>
        <div className="mt-4 h-1.5 bg-cream/15">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallPct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="h-full bg-primary"
          />
        </div>
      </motion.section>

      {/* Type cards */}
      <div className="flex flex-col gap-3 px-4">
        {CARDS.map((card) => (
          <TypeCard
            key={card.type}
            spec={card}
            progress={progress.byType[card.type]}
          />
        ))}
      </div>
    </motion.div>
  );
}

function TypeCard({
  spec,
  progress,
}: {
  spec: CardSpec;
  progress: ReadingProgress["byType"][MeterType];
}) {
  const { total, read } = progress;
  const remaining = Math.max(total - read, 0);
  const done = total > 0 && remaining === 0;
  const empty = total === 0;
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  const Icon = spec.icon;

  const buttonLabel = done
    ? "Done"
    : read === 0
      ? "Start"
      : "Continue";

  return (
    <motion.div
      variants={item}
      transition={spring}
      className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral/10"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className={`flex size-16 shrink-0 items-center justify-center rounded-2xl ${spec.accent} ${spec.onAccent} shadow`}
        >
          <Icon className="size-8" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="flex flex-1 flex-col">
          <h2 className="text-xl font-bold leading-tight text-ink">
            {spec.label}
          </h2>
          <p className="text-xs text-neutral">{spec.unitLabel}</p>
        </div>
      </div>

      {/* Progress bar + count */}
      <div className="flex flex-col gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral/15">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.1,
            }}
            className={`h-full rounded-full ${spec.accent}`}
          />
        </div>
        <p className="text-xs text-neutral">
          {read} of {total}
        </p>
      </div>

      {/* Action button */}
      {done ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary/15 py-4 text-base font-bold text-primary-hover">
          <CheckCircle2 className="size-5" aria-hidden />
          Done
        </div>
      ) : empty ? (
        <div className="rounded-2xl bg-neutral/15 py-4 text-center text-base font-semibold text-neutral">
          No meters
        </div>
      ) : (
        <MotionLink
          href={{ pathname: "/scan", query: { type: spec.type } }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center rounded-2xl bg-primary py-4 text-lg font-bold tracking-wide text-ink shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-hover"
        >
          {buttonLabel}
        </MotionLink>
      )}
    </motion.div>
  );
}
