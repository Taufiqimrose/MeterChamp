--------------------------------------------------------------------------------
-- Parks: per-park S3 bucket mapping.
--
-- One bucket per park gives per-park credential isolation and lets the
-- extraction platform get scoped read-only keys without seeing other parks.
--------------------------------------------------------------------------------

alter table public.parks
  add column s3_bucket text,
  add column s3_region text not null default 'us-west-1';

-- A given bucket should map to at most one park.
alter table public.parks
  add constraint parks_s3_bucket_unique unique (s3_bucket);

-- Bucket names follow S3 rules: 3–63 chars, lowercase letters, digits,
-- hyphens, dots; can't start/end with a hyphen or dot, can't have ".." or
-- ".-" sequences, can't look like an IP. The regex below covers the
-- character-set + length + edge-char rules; we don't try to validate every
-- exotic edge case (AWS rejects on PutObject anyway).
alter table public.parks
  add constraint parks_s3_bucket_format check (
    s3_bucket is null
    or (
      length(s3_bucket) between 3 and 63
      and s3_bucket ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'
      and s3_bucket !~ '\.\.'
      and s3_bucket !~ '\.-'
      and s3_bucket !~ '-\.'
    )
  );

comment on column public.parks.s3_bucket is
  'S3 bucket holding photos for this park. NULL while a park is being set up.';
comment on column public.parks.s3_region is
  'AWS region for s3_bucket. Default matches the Supabase project region.';
