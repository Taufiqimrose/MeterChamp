import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { getMyCaptures } from "@/lib/data/records";
import type { MeterType } from "@/lib/data/units";
import { RecordsFilterBar } from "@/app/_components/records-filter-bar";
import { RecordRow } from "@/app/_components/record-row";
import type { RangeOption } from "@/app/_components/records-range-select";

export const metadata: Metadata = {
  title: "Records",
};

const VALID_TYPES = new Set<MeterType>(["water", "gas", "electric"]);
const MONTH_RE = /^\d{4}-\d{2}$/;
// How many previous calendar months to surface in the dropdown by default.
const PREVIOUS_MONTHS = 6;

type ParsedRange = {
  /** The string that goes in the URL (and the <select> value). */
  rangeValue: string;
  fromIso?: string;
  toIso?: string;
  /** Human-readable label for the empty state, e.g. "April 2026". */
  monthLabel?: string;
};

function monthLabel(year: number, month1to12: number): string {
  return new Date(Date.UTC(year, month1to12 - 1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
}

function parseRange(raw: string | undefined, now: Date): ParsedRange {
  if (raw === "all") return { rangeValue: "all" };

  if (raw && MONTH_RE.test(raw)) {
    const [yStr, mStr] = raw.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (m >= 1 && m <= 12) {
      return {
        rangeValue: raw,
        fromIso: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
        toIso: new Date(Date.UTC(y, m, 1)).toISOString(),
        monthLabel: monthLabel(y, m),
      };
    }
  }

  return {
    rangeValue: "month",
    fromIso: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString(),
  };
}

function buildRangeOptions(now: Date, current: string): RangeOption[] {
  const opts: RangeOption[] = [{ value: "month", label: "This month" }];
  const seen = new Set<string>(["month"]);

  for (let i = 1; i <= PREVIOUS_MONTHS; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
    opts.push({
      value,
      label: monthLabel(d.getUTCFullYear(), d.getUTCMonth() + 1),
    });
    seen.add(value);
  }

  // If a deep-linked URL targets a month outside the default window, surface
  // it in the dropdown so the <select> value reflects what the user is
  // actually seeing.
  if (MONTH_RE.test(current) && !seen.has(current)) {
    const [yStr, mStr] = current.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    opts.push({ value: current, label: monthLabel(y, m) });
  }

  opts.push({ value: "all", label: "All time" });
  return opts;
}

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

  const now = new Date();
  const range = parseRange(sp.range, now);
  const rangeOptions = buildRangeOptions(now, range.rangeValue);

  const captures = await getMyCaptures({
    fromIso: range.fromIso,
    toIso: range.toIso,
    type,
    limit: 100,
  });

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="border-b border-neutral/15 px-4 py-3">
        <h1 className="text-xl font-bold text-ink">Records</h1>
        <p className="mt-1 text-xs text-neutral">Your meter capture history</p>
      </header>

      <RecordsFilterBar
        activeType={type}
        activeRange={range.rangeValue}
        rangeOptions={rangeOptions}
      />

      {captures.length === 0 ? (
        <EmptyState
          rangeValue={range.rangeValue}
          monthLabel={range.monthLabel}
          type={type}
        />
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
  rangeValue,
  monthLabel,
  type,
}: {
  rangeValue: string;
  monthLabel: string | undefined;
  type: MeterType | undefined;
}) {
  const periodPart = monthLabel
    ? `in ${monthLabel}`
    : rangeValue === "all"
      ? "yet"
      : "this month";
  const typePart = type ? `${type} ` : "";
  const message = `No ${typePart}captures ${periodPart}`;

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
