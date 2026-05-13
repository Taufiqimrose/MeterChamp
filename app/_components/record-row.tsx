import { Droplets, Flame, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MeterType } from "@/lib/data/units";
import type { CaptureRow, ExtractionStatus } from "@/lib/data/records";

const TYPE_STYLE: Record<MeterType, { icon: LucideIcon; chip: string }> = {
  water: { icon: Droplets, chip: "bg-blue-500 text-white" },
  electric: { icon: Zap, chip: "bg-primary text-ink" },
  gas: { icon: Flame, chip: "bg-rose-500 text-white" },
};

const STATUS_STYLE: Record<
  ExtractionStatus,
  { label: string; classes: string }
> = {
  extracted: {
    label: "Extracted",
    classes: "bg-emerald-500/10 text-emerald-700",
  },
  pending: {
    label: "Pending",
    classes: "bg-amber-500/10 text-amber-700",
  },
  failed: {
    label: "Failed",
    classes: "bg-rose-500/10 text-rose-700",
  },
};

// Relative-time computed at render. The records page is dynamic, so each
// request renders fresh values — staleness is bounded by request latency.
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function RecordRow({ row }: { row: CaptureRow }) {
  const style = TYPE_STYLE[row.meterType];
  const Icon = style.icon;
  const status = STATUS_STYLE[row.extractionStatus];

  return (
    <li className="flex items-center gap-4 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-neutral/10">
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${style.chip}`}
      >
        <Icon className="size-6" strokeWidth={2.25} aria-hidden />
      </div>
      <div className="flex flex-1 flex-col">
        <p className="text-sm font-semibold text-ink">
          <span className="capitalize">{row.meterType}</span> · Unit{" "}
          {row.unitLabel}
        </p>
        <p className="text-xs text-neutral">
          {formatRelative(row.capturedAt)} · {row.unitOfMeasure}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.classes}`}
      >
        {status.label}
      </span>
    </li>
  );
}
