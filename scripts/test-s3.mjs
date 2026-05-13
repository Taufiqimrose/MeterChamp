/**
 * S3 smoke test. Verifies the writer credentials in .env.local can PUT and
 * GET an object in the target bucket. Leaves a small marker object behind.
 *
 *   node --env-file=.env.local scripts/test-s3.mjs
 *   node --env-file=.env.local scripts/test-s3.mjs other-bucket-name
 *
 * Note: HeadBucket is intentionally NOT tested — it requires s3:ListBucket
 * which the writer-only policy doesn't grant. PutObject + GetObject covers
 * what the app actually does in production.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const BUCKET = process.argv[2] ?? "mme-cherry-orchard-prod";
const REGION = process.env.AWS_REGION ?? "us-west-1";

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error(
    "✗ Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in env.",
  );
  console.error("  Run with: node --env-file=.env.local scripts/test-s3.mjs");
  process.exit(1);
}

console.log(`Bucket : ${BUCKET}`);
console.log(`Region : ${REGION}`);
console.log(`Key ID : ${process.env.AWS_ACCESS_KEY_ID.slice(0, 6)}…\n`);

const s3 = new S3Client({ region: REGION });

const testKey = `_health/smoke-${Date.now()}.txt`;
const body = `Meter Champ S3 smoke test — ${new Date().toISOString()}\n`;

try {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
      Body: body,
      ContentType: "text/plain",
      Metadata: { source: "mme-smoke-test" },
    }),
  );
  console.log(`✓ PutObject  s3://${BUCKET}/${testKey}`);
} catch (err) {
  console.error("✗ PutObject failed");
  console.error("  message:", err.message);
  console.error("  name:   ", err.name);
  console.error("  http:   ", err.$metadata?.httpStatusCode);
  process.exit(1);
}

try {
  const out = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: testKey }),
  );
  const text = await out.Body.transformToString();
  if (text === body) {
    console.log(`✓ GetObject  round-tripped ${text.length} bytes`);
  } else {
    console.error("✗ GetObject body mismatch");
    process.exit(1);
  }
} catch (err) {
  console.error("✗ GetObject failed");
  console.error("  message:", err.message);
  console.error("  name:   ", err.name);
  console.error("  http:   ", err.$metadata?.httpStatusCode);
  process.exit(1);
}

console.log("\nAll checks passed.");
console.log(
  `Test object left at s3://${BUCKET}/${testKey} — delete it via the console if you'd like.`,
);
