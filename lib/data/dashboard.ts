import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface DashboardSnapshot {
  fullName: string;
  parkId: string | null;
  parkName: string | null;
  totalMeters: number;
  readingsThisMonth: number;
  lastMeter: {
    capturedAt: string;
    unitLabel: string;
    meterType: string;
  } | null;
}

/**
 * Loads everything the dashboard needs in a few round-trips. Designed for a
 * Server Component on /dashboard. Returns null fields when the user has no
 * active assignment so the page can render an empty state.
 */
export async function getDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Profile (for the greeting).
  const profilePromise = supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Progress view: totals + readings_this_month, scoped to active assignment.
  const progressPromise = supabase
    .from("current_park_progress")
    .select("park_id, park_name, total_meters, readings_this_month")
    .eq("user_id", user.id)
    .maybeSingle();

  const [profileRes, progressRes] = await Promise.all([
    profilePromise,
    progressPromise,
  ]);

  const fullName = profileRes.data?.full_name ?? "there";

  if (!progressRes.data?.park_id) {
    return {
      fullName,
      parkId: null,
      parkName: null,
      totalMeters: 0,
      readingsThisMonth: 0,
      lastMeter: null,
    };
  }

  const { park_id, park_name, total_meters, readings_this_month } =
    progressRes.data;

  // Latest non-superseded reading on a meter in this park, plus the unit
  // label and meter type for display. One round trip via a relationship
  // select.
  const lastReadingRes = await supabase
    .from("meter_readings")
    .select(
      `
      captured_at,
      unit_meters!inner (
        meter_type,
        units!inner ( label, park_id )
      )
    `,
    )
    .eq("unit_meters.units.park_id", park_id)
    .is("superseded_by", null)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type LastReadingRow = {
    captured_at: string;
    unit_meters: {
      meter_type: string;
      units: { label: string };
    };
  };
  const lastReading = lastReadingRes.data as LastReadingRow | null;

  return {
    fullName,
    parkId: park_id,
    parkName: park_name,
    totalMeters: total_meters ?? 0,
    readingsThisMonth: readings_this_month ?? 0,
    lastMeter: lastReading
      ? {
          capturedAt: lastReading.captured_at,
          unitLabel: lastReading.unit_meters.units.label,
          meterType: lastReading.unit_meters.meter_type,
        }
      : null,
  };
}
