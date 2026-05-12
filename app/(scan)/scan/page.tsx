import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ScanCamera } from "@/app/_components/scan-camera";
import { getNextPendingMeter } from "@/lib/data/reading";
import type { MeterType } from "@/lib/data/units";

export const metadata: Metadata = {
  title: "Scan meter",
};

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<MeterType>(["water", "gas", "electric"]);

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;

  if (!type || !VALID_TYPES.has(type as MeterType)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black px-8 text-center text-white">
        <h1 className="text-2xl font-bold">Pick a meter type first</h1>
        <Link
          href="/read"
          className="rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-ink"
        >
          Pick meter type
        </Link>
      </div>
    );
  }

  const meterType = type as MeterType;
  const next = await getNextPendingMeter(meterType);

  if (!next) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black px-8 text-center text-white">
        <div className="flex size-24 items-center justify-center rounded-3xl bg-primary/20 text-primary">
          <CheckCircle2 className="size-14" strokeWidth={2} aria-hidden />
        </div>
        <div className="flex max-w-xs flex-col gap-2">
          <h1 className="text-2xl font-bold capitalize">
            All {meterType} meters read
          </h1>
          <p className="text-sm text-white/70">
            You&apos;ve captured every {meterType} meter for this cycle. Pick
            another meter type or head back to the dashboard.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/read"
            className="rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-ink"
          >
            Pick another type
          </Link>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-white/30 px-6 py-3 text-base font-medium text-white"
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ScanCamera
      unitMeterId={next.unitMeterId}
      unitId={next.unitId}
      unitLabel={next.unitLabel}
      meterType={next.meterType}
      unitOfMeasure={next.unitOfMeasure}
      remaining={next.remaining}
      progressionType={meterType}
    />
  );
}
