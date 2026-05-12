import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MeterType = "water" | "gas" | "electric";

/**
 * Resolve a unit_meter_id to everything the capture flow needs:
 * the unit, the park, and the S3 bucket to write into. RLS ensures this
 * returns null when the caller isn't assigned to this unit's park.
 */
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
  const row = data as unknown as Row;

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
