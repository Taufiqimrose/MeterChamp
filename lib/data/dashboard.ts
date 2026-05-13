import "server-only";
import { createClient, getUser } from "@/lib/supabase/server";

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
  const user = await getUser();
  if (!user) return null;

  // All three queries fire in parallel. The previous version awaited
  // profile + progress, then issued the last-reading query gated on a
  // park_id from progress — but RLS already scopes photos to the user's
  // current park, so the explicit park filter is redundant and lets us
  // drop one sequential round-trip.
  const [profileRes, progressRes, lastReadingRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("current_park_progress")
      .select("park_id, park_name, total_meters, readings_this_month")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("photos")
      .select(
        `
        captured_at,
        unit_meters!inner (
          meter_type,
          units!inner ( label )
        )
      `,
      )
      .eq("kind", "meter_reading")
      .is("deleted_at", null)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  type LastReadingRow = {
    captured_at: string;
    unit_meters: {
      meter_type: string;
      units: { label: string };
    };
  };
  const lastReading = lastReadingRes.data as unknown as LastReadingRow | null;

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
