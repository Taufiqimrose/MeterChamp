import Link from "next/link";
import type { MeterType } from "@/lib/data/units";

type FilterBarProps = {
  activeType: MeterType | undefined;
  activeRange: "month" | "all";
};

const TYPES: { value: MeterType | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "electric", label: "Electric" },
];

const RANGES: { value: "month" | "all"; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

function buildHref(opts: {
  type?: MeterType;
  range: "month" | "all";
}): string {
  const sp = new URLSearchParams();
  if (opts.type) sp.set("type", opts.type);
  // "month" is the default; omit from URL to keep it clean.
  if (opts.range !== "month") sp.set("range", opts.range);
  const qs = sp.toString();
  return qs ? `/records?${qs}` : "/records";
}

export function RecordsFilterBar({
  activeType,
  activeRange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 px-4">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by meter type"
      >
        {TYPES.map((t) => {
          const active = t.value === activeType;
          return (
            <Link
              key={t.label}
              href={buildHref({ type: t.value, range: activeRange })}
              aria-pressed={active}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-ink text-cream"
                  : "bg-neutral/10 text-ink hover:bg-neutral/15"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div
        className="flex gap-1 text-xs"
        role="group"
        aria-label="Filter by time range"
      >
        {RANGES.map((r) => {
          const active = r.value === activeRange;
          return (
            <Link
              key={r.value}
              href={buildHref({ type: activeType, range: r.value })}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 transition-colors ${
                active
                  ? "bg-secondary/15 font-semibold text-secondary"
                  : "text-neutral hover:text-ink"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
