import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { getMyCaptures } from "@/lib/data/records";
import type { MeterType } from "@/lib/data/units";
import { RecordsFilterBar } from "@/app/_components/records-filter-bar";
import { RecordRow } from "@/app/_components/record-row";

export const metadata: Metadata = {
  title: "Records",
};

const VALID_TYPES = new Set<MeterType>(["water", "gas", "electric"]);

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const type =
    sp.type && VALID_TYPES.has(sp.type as MeterType)
      ? (sp.type as MeterType)
      : undefined;
  const range = sp.range === "all" ? "all" : "month";

  const captures = await getMyCaptures({ range, type, limit: 100 });

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="border-b border-neutral/15 px-4 py-3">
        <h1 className="text-xl font-bold text-ink">Records</h1>
        <p className="mt-1 text-xs text-neutral">Your meter capture history</p>
      </header>

      <RecordsFilterBar activeType={type} activeRange={range} />

      {captures.length === 0 ? (
        <EmptyState range={range} type={type} />
      ) : (
        <ul className="flex flex-col gap-2 px-4">
          {captures.map((c) => (
            <RecordRow key={c.id} row={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({
  range,
  type,
}: {
  range: "month" | "all";
  type: MeterType | undefined;
}) {
  const message =
    type && range === "month"
      ? `No ${type} captures this month`
      : type
        ? `No ${type} captures yet`
        : range === "month"
          ? "No captures this month"
          : "No captures yet";

  return (
    <div className="mt-8 flex flex-col items-center gap-4 px-8 text-center">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-neutral/10 text-neutral">
        <Camera className="size-10" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="text-base font-semibold text-ink">{message}</p>
      <p className="max-w-xs text-sm text-neutral">
        Captures appear here as soon as you scan a meter.
      </p>
      <Link
        href="/read"
        className="mt-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-primary-hover"
      >
        Start scanning
      </Link>
    </div>
  );
}
