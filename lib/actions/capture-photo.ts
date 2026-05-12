"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { getCaptureContext } from "@/lib/data/units";

type CaptureResult =
  | { ok: true; photoId: string; unitId: string; s3Key: string }
  | { ok: false; error: string };

export async function capturePhoto(formData: FormData): Promise<CaptureResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const unitMeterId = formData.get("unit_meter_id");
  const photo = formData.get("photo");

  if (typeof unitMeterId !== "string" || !(photo instanceof Blob)) {
    return { ok: false, error: "Missing unit_meter_id or photo" };
  }
  if (photo.size === 0) {
    return { ok: false, error: "Empty photo blob" };
  }

  // RLS makes this null if the user isn't assigned to this unit's park.
  const ctx = await getCaptureContext(unitMeterId);
  if (!ctx) {
    return { ok: false, error: "Unit meter not accessible" };
  }

  const photoId = randomUUID();
  const mimeType = photo.type || "image/jpeg";
  const ext = inferExtension(mimeType) ?? "jpg";
  const s3Key = `${ctx.parkId}/${ctx.unitId}/${ctx.meterType}/${photoId}.${ext}`;
  const capturedAt = new Date().toISOString();

  const gpsLat = parseFloatOrNull(formData.get("gps_lat"));
  const gpsLng = parseFloatOrNull(formData.get("gps_lng"));
  const gpsAccuracyM = parseFloatOrNull(formData.get("gps_accuracy_m"));
  const qualityScore = parseFloatOrNull(formData.get("quality_score"));
  const userAgent =
    typeof formData.get("user_agent") === "string"
      ? (formData.get("user_agent") as string)
      : null;

  // S3 user-defined metadata. The SDK prepends `x-amz-meta-` for us.
  // Keys are sent lowercase; values must be ASCII (AWS strips non-ASCII).
  const s3Metadata: Record<string, string> = {
    "park-id": ctx.parkId,
    "park-name": asciiSafe(ctx.parkName),
    "unit-id": ctx.unitId,
    "unit-label": asciiSafe(ctx.unitLabel),
    "unit-meter-id": ctx.unitMeterId,
    "meter-type": ctx.meterType,
    "meter-uom": ctx.unitOfMeasure,
    "captured-at": capturedAt,
    "captured-by": user.id,
    "photo-id": photoId,
    "app-version": process.env.npm_package_version ?? "0.1.0",
  };
  if (ctx.serialLabel)
    s3Metadata["serial-label"] = asciiSafe(ctx.serialLabel);
  if (gpsLat !== null) s3Metadata["gps-lat"] = gpsLat.toString();
  if (gpsLng !== null) s3Metadata["gps-lng"] = gpsLng.toString();
  if (gpsAccuracyM !== null)
    s3Metadata["gps-accuracy-m"] = gpsAccuracyM.toString();
  if (qualityScore !== null)
    s3Metadata["quality-score"] = qualityScore.toFixed(4);

  const arrayBuffer = await photo.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);

  const s3 = new S3Client({ region: ctx.s3Region });
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: ctx.s3Bucket,
        Key: s3Key,
        Body: body,
        ContentType: mimeType,
        Metadata: s3Metadata,
      }),
    );
  } catch (err) {
    console.error("[capturePhoto] S3 upload failed", err);
    return { ok: false, error: "Photo upload failed" };
  }

  const { error: insertErr } = await supabase.from("photos").insert({
    id: photoId,
    unit_id: ctx.unitId,
    unit_meter_id: ctx.unitMeterId,
    kind: "meter_reading",
    s3_bucket: ctx.s3Bucket,
    s3_key: s3Key,
    mime_type: mimeType,
    size_bytes: arrayBuffer.byteLength,
    captured_at: capturedAt,
    captured_by: user.id,
    notes: userAgent ? `ua=${userAgent.slice(0, 200)}` : null,
  });

  if (insertErr) {
    console.error("[capturePhoto] photos insert failed", insertErr);
    // S3 object is now orphaned. The extraction service should treat
    // photos without a DB row as garbage; we could also enqueue a cleanup.
    return { ok: false, error: "Database write failed" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/read");
  revalidatePath("/scan");

  return { ok: true, photoId, unitId: ctx.unitId, s3Key };
}

function inferExtension(mime: string): string | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

function parseFloatOrNull(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * S3 user metadata is sent as HTTP headers; non-ASCII values get stripped by
 * AWS to `?`. Strip anything outside printable ASCII so the extraction service
 * doesn't see corrupt values.
 */
function asciiSafe(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, "");
}
