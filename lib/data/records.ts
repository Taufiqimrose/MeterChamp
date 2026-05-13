import "server-only";
import { createClient, getUser } from "@/lib/supabase/server";
import type { MeterType } from "@/lib/data/units";

export type ExtractionStatus = "pending" | "extracted" | "failed";

export interface CaptureRow {
  id: string;
  capturedAt: string;
  meterType: MeterType;
  unitLabel: string;
  unitOfMeasure: string;
  extractionStatus: ExtractionStatus;
}

export interface CapturesQuery {
  range: "month" | "all";
  type?: MeterType;
  limit?: number;
}

// UTC-anchored to match the DB views (date_trunc('month', now())) so the
// "this month" filter is consistent across surfaces.
function startOfMonthIso(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
  ).toISOString();
}

/**
 * The current reader's own capture history. RLS already scopes photos to
 * the user's assigned park, and we narrow further with `captured_by` so
 * Records reads as "my work" — not the whole team's.
 */
export async function getMyCaptures(
  opts: CapturesQuery,
): Promise<CaptureRow[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  let query = supabase
    .from("photos")
    .select(
      `
      id,
      captured_at,
      extraction_status,
      unit_meters!inner (
        meter_type,
        unit_of_measure,
        units!inner ( label )
      )
    `,
    )
    .eq("kind", "meter_reading")
    .eq("captured_by", user.id)
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.range === "month") {
    query = query.gte("captured_at", startOfMonthIso(new Date()));
  }

  if (opts.type) {
    query = query.eq("unit_meters.meter_type", opts.type);
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    id: string;
    captured_at: string;
    extraction_status: ExtractionStatus;
    unit_meters: {
      meter_type: MeterType;
      unit_of_measure: string;
      units: { label: string };
    };
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    capturedAt: r.captured_at,
    meterType: r.unit_meters.meter_type,
    unitLabel: r.unit_meters.units.label,
    unitOfMeasure: r.unit_meters.unit_of_measure,
    extractionStatus: r.extraction_status,
  }));
}
