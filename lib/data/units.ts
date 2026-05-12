import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MeterType = "water" | "gas" | "electric";

export interface UnitMeterSummary {
  id: string;
  meterType: MeterType;
  unitOfMeasure: string;
  serialLabel: string | null;
  lastReadingAt: string | null;
  readThisMonth: boolean;
}

export interface UnitWithMeters {
  id: string;
  label: string;
  streetAddress: string | null;
  meters: UnitMeterSummary[];
}

export interface UnitListItem {
  id: string;
  label: string;
  streetAddress: string | null;
  totalMeters: number;
  readThisMonth: number;
}

/** Units in the user's assigned park, sorted by label. */
export async function listUnitsForCurrentUser(): Promise<UnitListItem[]> {
  const supabase = await createClient();

  // unit_meters with units — RLS already filters to the user's assigned park.
  const { data: ums, error } = await supabase
    .from("unit_meters")
    .select(
      `
      id,
      meter_type,
      units!inner ( id, label, street_address ),
      meter_readings ( captured_at, superseded_by )
    `,
    )
    .eq("active", true);

  if (error) throw error;

  type Row = {
    id: string;
    meter_type: string;
    units: { id: string; label: string; street_address: string | null };
    meter_readings: { captured_at: string; superseded_by: string | null }[];
  };

  const monthStart = startOfMonth(new Date());
  const map = new Map<string, UnitListItem>();

  for (const row of (ums ?? []) as Row[]) {
    const unit = row.units;
    if (!map.has(unit.id)) {
      map.set(unit.id, {
        id: unit.id,
        label: unit.label,
        streetAddress: unit.street_address,
        totalMeters: 0,
        readThisMonth: 0,
      });
    }
    const item = map.get(unit.id)!;
    item.totalMeters += 1;

    const hasReadingThisMonth = row.meter_readings.some(
      (r) =>
        r.superseded_by === null &&
        new Date(r.captured_at).getTime() >= monthStart,
    );
    if (hasReadingThisMonth) item.readThisMonth += 1;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
}

/** Single unit + every meter on it, with last-reading metadata. */
export async function getUnitWithMeters(
  unitId: string,
): Promise<UnitWithMeters | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("units")
    .select(
      `
      id,
      label,
      street_address,
      unit_meters (
        id,
        meter_type,
        unit_of_measure,
        serial_label,
        active,
        meter_readings ( captured_at, superseded_by )
      )
    `,
    )
    .eq("id", unitId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  type Row = {
    id: string;
    label: string;
    street_address: string | null;
    unit_meters: {
      id: string;
      meter_type: MeterType;
      unit_of_measure: string;
      serial_label: string | null;
      active: boolean;
      meter_readings: { captured_at: string; superseded_by: string | null }[];
    }[];
  };
  const row = data as Row;

  const monthStart = startOfMonth(new Date());

  const meters: UnitMeterSummary[] = row.unit_meters
    .filter((m) => m.active)
    .map((m) => {
      const live = m.meter_readings
        .filter((r) => r.superseded_by === null)
        .sort(
          (a, b) =>
            new Date(b.captured_at).getTime() -
            new Date(a.captured_at).getTime(),
        );
      const last = live[0];
      return {
        id: m.id,
        meterType: m.meter_type,
        unitOfMeasure: m.unit_of_measure,
        serialLabel: m.serial_label,
        lastReadingAt: last?.captured_at ?? null,
        readThisMonth: last
          ? new Date(last.captured_at).getTime() >= monthStart
          : false,
      };
    })
    .sort((a, b) => a.meterType.localeCompare(b.meterType));

  return {
    id: row.id,
    label: row.label,
    streetAddress: row.street_address,
    meters,
  };
}

/** Resolves a unit_meter_id to the destination bucket + the unit/meter context. */
export async function getCaptureContext(unitMeterId: string): Promise<{
  unitMeterId: string;
  unitId: string;
  unitLabel: string;
  parkId: string;
  parkName: string;
  meterType: MeterType;
  unitOfMeasure: string;
  serialLabel: string | null;
  s3Bucket: string;
  s3Region: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_meters")
    .select(
      `
      id,
      meter_type,
      unit_of_measure,
      serial_label,
      units!inner (
        id,
        label,
        parks!inner ( id, name, s3_bucket, s3_region )
      )
    `,
    )
    .eq("id", unitMeterId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  type Row = {
    id: string;
    meter_type: MeterType;
    unit_of_measure: string;
    serial_label: string | null;
    units: {
      id: string;
      label: string;
      parks: {
        id: string;
        name: string;
        s3_bucket: string | null;
        s3_region: string;
      };
    };
  };
  const row = data as Row;

  if (!row.units.parks.s3_bucket) return null;

  return {
    unitMeterId: row.id,
    unitId: row.units.id,
    unitLabel: row.units.label,
    parkId: row.units.parks.id,
    parkName: row.units.parks.name,
    meterType: row.meter_type,
    unitOfMeasure: row.unit_of_measure,
    serialLabel: row.serial_label,
    s3Bucket: row.units.parks.s3_bucket,
    s3Region: row.units.parks.s3_region,
  };
}

function startOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
