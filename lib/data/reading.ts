import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCaptureContext } from "@/lib/data/units";
import type { MeterType } from "@/lib/data/units";

export interface MeterTypeProgress {
  total: number;
  read: number;
  nextLabel: string | null;
}

export interface ReadingProgress {
  parkId: string;
  parkName: string;
  byType: Record<MeterType, MeterTypeProgress>;
}

/**
 * For the meter-type picker: how many of each type the user's park has, and
 * how many are already read this cycle.
 */
export async function getReadingProgress(): Promise<ReadingProgress | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: assignment } = await supabase
    .from("park_assignments")
    .select("park_id, parks!inner ( id, name )")
    .eq("user_id", user.id)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type AssignmentRow = {
    park_id: string;
    parks: { id: string; name: string };
  };
  const a = assignment as AssignmentRow | null;
  if (!a) return null;

  const { data: meters, error } = await supabase
    .from("unit_meters")
    .select(
      `id, meter_type, units!inner ( park_id, active, label ),
       meter_readings ( captured_at, superseded_by )`,
    )
    .eq("active", true)
    .eq("units.park_id", a.park_id)
    .eq("units.active", true);
  if (error) throw error;

  type MeterRow = {
    id: string;
    meter_type: MeterType;
    units: { label: string };
    meter_readings: { captured_at: string; superseded_by: string | null }[];
  };

  const monthStart = startOfMonth(new Date());
  const byType: Record<MeterType, MeterTypeProgress> = {
    water: { total: 0, read: 0, nextLabel: null },
    gas: { total: 0, read: 0, nextLabel: null },
    electric: { total: 0, read: 0, nextLabel: null },
  };

  for (const m of (meters ?? []) as MeterRow[]) {
    const slot = byType[m.meter_type];
    slot.total += 1;
    const readThisCycle = m.meter_readings.some(
      (r) =>
        r.superseded_by === null &&
        new Date(r.captured_at).getTime() >= monthStart,
    );
    if (readThisCycle) {
      slot.read += 1;
    } else {
      const candidate = m.units.label;
      if (
        slot.nextLabel === null ||
        candidate.localeCompare(slot.nextLabel, undefined, { numeric: true }) <
          0
      ) {
        slot.nextLabel = candidate;
      }
    }
  }

  return {
    parkId: a.parks.id,
    parkName: a.parks.name,
    byType,
  };
}

/**
 * Find the next pending unit_meter of a given type for the current user.
 * Pending = no non-superseded reading this calendar month.
 * Ordered by unit label ascending so readers walk the park in order.
 *
 * Returns the full capture context (bucket, names, meter info) so /scan can
 * render in one round-trip.
 */
export async function getNextPendingMeter(meterType: MeterType): Promise<
  | (Awaited<ReturnType<typeof getCaptureContext>> & {
      remaining: number;
    })
  | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Find current park.
  const { data: assignment } = await supabase
    .from("park_assignments")
    .select("park_id")
    .eq("user_id", user.id)
    .is("unassigned_at", null)
    .limit(1)
    .maybeSingle();
  if (!assignment?.park_id) return null;

  // Pull all active meters of this type in the park with their readings.
  const { data: meters, error } = await supabase
    .from("unit_meters")
    .select(
      `id, units!inner ( id, label, park_id, active ),
       meter_readings ( captured_at, superseded_by )`,
    )
    .eq("active", true)
    .eq("meter_type", meterType)
    .eq("units.park_id", assignment.park_id)
    .eq("units.active", true);
  if (error) throw error;

  type Row = {
    id: string;
    units: { id: string; label: string };
    meter_readings: { captured_at: string; superseded_by: string | null }[];
  };

  const monthStart = startOfMonth(new Date());
  const pending = (meters as Row[] | null ?? [])
    .filter(
      (m) =>
        !m.meter_readings.some(
          (r) =>
            r.superseded_by === null &&
            new Date(r.captured_at).getTime() >= monthStart,
        ),
    )
    .sort((a, b) =>
      a.units.label.localeCompare(b.units.label, undefined, {
        numeric: true,
      }),
    );

  if (pending.length === 0) return null;

  const next = pending[0];
  // getCaptureContext returns the same shape we need; one extra call but
  // keeps bucket-resolution logic in a single place.
  const ctx = await getCaptureContext(next.id);
  if (!ctx) return null;

  return { ...ctx, remaining: pending.length };
}

function startOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
