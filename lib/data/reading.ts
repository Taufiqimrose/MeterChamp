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
 * how many have been *captured* this cycle.
 *
 * "Captured" means there's at least one non-deleted meter_reading photo on
 * the meter this calendar month. The extraction service running on a separate
 * platform produces meter_readings later; we don't gate the reader's UI on
 * that — they're done as soon as they upload a photo.
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
  const a = assignment as unknown as AssignmentRow | null;
  if (!a) return null;

  const monthStartIso = startOfMonthIso(new Date());

  const { data: meters, error } = await supabase
    .from("unit_meters")
    .select(
      `id, meter_type, units!inner ( park_id, active, label ),
       photos ( captured_at, deleted_at, kind )`,
    )
    .eq("active", true)
    .eq("units.park_id", a.park_id)
    .eq("units.active", true);
  if (error) throw error;

  type MeterRow = {
    id: string;
    meter_type: MeterType;
    units: { label: string };
    photos: {
      captured_at: string;
      deleted_at: string | null;
      kind: string;
    }[];
  };

  const byType: Record<MeterType, MeterTypeProgress> = {
    water: { total: 0, read: 0, nextLabel: null },
    gas: { total: 0, read: 0, nextLabel: null },
    electric: { total: 0, read: 0, nextLabel: null },
  };

  for (const m of (meters ?? []) as unknown as MeterRow[]) {
    const slot = byType[m.meter_type];
    slot.total += 1;
    const capturedThisCycle = m.photos.some(
      (p) =>
        p.kind === "meter_reading" &&
        p.deleted_at === null &&
        p.captured_at >= monthStartIso,
    );
    if (capturedThisCycle) {
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
    })
  | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const { data: meters, error } = await supabase
    .from("unit_meters")
    .select(
      `id, units!inner ( id, label, park_id, active ),
       photos ( captured_at, deleted_at, kind )`,
    )
    .eq("active", true)
    .eq("meter_type", meterType)
    .eq("units.park_id", assignment.park_id)
    .eq("units.active", true);
  if (error) throw error;

  type Row = {
    id: string;
    units: { id: string; label: string };
    photos: {
      captured_at: string;
      deleted_at: string | null;
      kind: string;
    }[];
  };

  const pending = ((meters ?? []) as unknown as Row[])
    .filter(
      (m) =>
        !m.photos.some(
          (p) =>
            p.kind === "meter_reading" &&
            p.deleted_at === null &&
            p.captured_at >= monthStartIso,
        ),
    )
    .sort((a, b) =>
      a.units.label.localeCompare(b.units.label, undefined, {
        numeric: true,
      }),
    );

  if (pending.length === 0) return null;

  const next = pending[0];
  const ctx = await getCaptureContext(next.id);
  if (!ctx) return null;

  return { ...ctx, remaining: pending.length };
}

function startOfMonthIso(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
