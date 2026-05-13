import "server-only";
import { createClient, getUser } from "@/lib/supabase/server";
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
 * how many have been *captured* this cycle.
 *
 * "Captured" means there's at least one non-deleted meter_reading photo on
 * the meter this calendar month. The extraction service running on a separate
 * platform produces meter_readings later; we don't gate the reader's UI on
 * that — they're done as soon as they upload a photo.
 */
export async function getReadingProgress(): Promise<ReadingProgress | null> {
  const supabase = await createClient();
  const user = await getUser();
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
  const a = assignment as unknown as AssignmentRow | null;
  if (!a) return null;

  const monthStartIso = startOfMonthIso(new Date());

  // Two scoped queries beat one join: the old version pulled every photo
  // ever recorded against every meter in the park, just to ask "was this
  // meter captured this cycle?". Now we fetch the meter list and the
  // captured-this-cycle set separately, both bounded by park size.
  const [metersRes, capturedRes] = await Promise.all([
    supabase
      .from("unit_meters")
      .select(`id, meter_type, units!inner ( label, park_id, active )`)
      .eq("active", true)
      .eq("units.park_id", a.park_id)
      .eq("units.active", true),
    supabase
      .from("photos")
      .select("unit_meter_id")
      .eq("kind", "meter_reading")
      .is("deleted_at", null)
      .gte("captured_at", monthStartIso),
  ]);
  if (metersRes.error) throw metersRes.error;
  if (capturedRes.error) throw capturedRes.error;

  type MeterRow = {
    id: string;
    meter_type: MeterType;
    units: { label: string };
  };

  const capturedSet = new Set<string>();
  for (const row of (capturedRes.data ?? []) as {
    unit_meter_id: string;
  }[]) {
    capturedSet.add(row.unit_meter_id);
  }

  const byType: Record<MeterType, MeterTypeProgress> = {
    water: { total: 0, read: 0, nextLabel: null },
    gas: { total: 0, read: 0, nextLabel: null },
    electric: { total: 0, read: 0, nextLabel: null },
  };

  for (const m of (metersRes.data ?? []) as unknown as MeterRow[]) {
    const slot = byType[m.meter_type];
    slot.total += 1;
    if (capturedSet.has(m.id)) {
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
 * Pending = no non-deleted meter_reading photo captured this calendar month.
 * Ordered by unit label ascending so readers walk the park in order.
 */
export async function getNextPendingMeter(meterType: MeterType): Promise<
  | (Awaited<ReturnType<typeof getCaptureContext>> & {
      remaining: number;
      total: number;
    })
  | null
> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { data: assignment } = await supabase
    .from("park_assignments")
    .select("park_id")
    .eq("user_id", user.id)
    .is("unassigned_at", null)
    .limit(1)
    .maybeSingle();
  if (!assignment?.park_id) return null;

  const monthStartIso = startOfMonthIso(new Date());

  const [metersRes, capturedRes] = await Promise.all([
    supabase
      .from("unit_meters")
      .select(`id, units!inner ( id, label, park_id, active )`)
      .eq("active", true)
      .eq("meter_type", meterType)
      .eq("units.park_id", assignment.park_id)
      .eq("units.active", true),
    supabase
      .from("photos")
      .select("unit_meter_id")
      .eq("kind", "meter_reading")
      .is("deleted_at", null)
      .gte("captured_at", monthStartIso),
  ]);
  if (metersRes.error) throw metersRes.error;
  if (capturedRes.error) throw capturedRes.error;

  type Row = {
    id: string;
    units: { id: string; label: string };
  };

  const capturedSet = new Set<string>();
  for (const row of (capturedRes.data ?? []) as {
    unit_meter_id: string;
  }[]) {
    capturedSet.add(row.unit_meter_id);
  }

  const rows = (metersRes.data ?? []) as unknown as Row[];
  const total = rows.length;
  const pending = rows
    .filter((m) => !capturedSet.has(m.id))
    .sort((a, b) =>
      a.units.label.localeCompare(b.units.label, undefined, {
        numeric: true,
      }),
    );

  if (pending.length === 0) return null;

  const next = pending[0];
  const ctx = await getCaptureContext(next.id);
  if (!ctx) return null;

  return { ...ctx, remaining: pending.length, total };
}

// Match the `current_park_progress` view, which uses `date_trunc('month',
// now())` against a UTC session — i.e. UTC midnight on the 1st. Using local
// getters here would drift by the server's UTC offset and put the dashboard
// count and the read-picker count out of sync near month boundaries.
function startOfMonthIso(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
  ).toISOString();
}
