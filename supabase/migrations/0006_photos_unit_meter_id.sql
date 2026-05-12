--------------------------------------------------------------------------------
-- The reader's smart progression needs to know "which unit_meter has a photo
-- this cycle?" — `photos` only links to `unit_id`, so today we'd have to parse
-- the S3 key to recover meter_type. Add a direct FK to unit_meters.
--
-- For kind='meter_reading' the FK is required (every meter photo belongs to
-- exactly one meter). For kind='unit_reference' it stays NULL (reference
-- photos are about the unit, not a specific meter).
--
-- Backfill existing rows from the structured S3 key path. The key format we
-- already write is `{park_id}/{unit_id}/{meter_type}/{photo_id}.{ext}`.
-- After backfill, the current_park_progress view switches to counting photos
-- this month instead of meter_readings, since extraction (which populates
-- readings) happens on a separate platform and shouldn't gate the reader's
-- progress UI.
--------------------------------------------------------------------------------

alter table public.photos
  add column unit_meter_id uuid references public.unit_meters(id);

-- Backfill: read meter_type out of the third path segment of s3_key and
-- match it against unit_meters for the photo's unit.
update public.photos p
set unit_meter_id = um.id
from public.unit_meters um
where p.kind = 'meter_reading'
  and um.unit_id = p.unit_id
  and um.meter_type::text = split_part(p.s3_key, '/', 3);

-- Drop the previous kind/meter_reading_id check and replace with one that
-- also requires unit_meter_id when kind='meter_reading'.
alter table public.photos drop constraint photos_kind_consistency;

alter table public.photos add constraint photos_kind_consistency check (
  (kind = 'meter_reading' and unit_meter_id is not null)
  or (
    kind = 'unit_reference'
    and unit_meter_id is null
    and meter_reading_id is null
  )
);

create index photos_unit_meter_captured_idx
  on public.photos (unit_meter_id, captured_at desc)
  where deleted_at is null and kind = 'meter_reading';

--------------------------------------------------------------------------------
-- Update the dashboard view to count captures (photos), not extracted
-- readings. The reader's job is "capture every meter this cycle" — extraction
-- is downstream.
--------------------------------------------------------------------------------

create or replace view public.current_park_progress
with (security_invoker = true) as
select
  pa.user_id,
  pa.park_id,
  p.name as park_name,
  (
    select count(*) from public.unit_meters um
    join public.units u on u.id = um.unit_id
    where u.park_id = pa.park_id and u.active and um.active
  ) as total_meters,
  (
    select count(distinct ph.unit_meter_id)
    from public.photos ph
    join public.unit_meters um on um.id = ph.unit_meter_id
    join public.units u on u.id = um.unit_id
    where u.park_id = pa.park_id
      and ph.kind = 'meter_reading'
      and ph.deleted_at is null
      and ph.captured_at >= date_trunc('month', now())
  ) as readings_this_month
from public.park_assignments pa
join public.parks p on p.id = pa.park_id
where pa.unassigned_at is null;
