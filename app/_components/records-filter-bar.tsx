import Link from "next/link";
import type { MeterType } from "@/lib/data/units";
import {
  RecordsRangeSelect,
  type RangeOption,
} from "@/app/_components/records-range-select";

type FilterBarProps = {
  activeType: MeterType | undefined;
  activeRange: string;
  rangeOptions: RangeOption[];
};

const TYPES: { value: MeterType | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "electric", label: "Electric" },
];

function buildHref(opts: { type?: MeterType; range: string }): string {
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
  rangeOptions,
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

      <div>
        <RecordsRangeSelect value={activeRange} options={rangeOptions} />
      </div>
    </div>
  );
}
