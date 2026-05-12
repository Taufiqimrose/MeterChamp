--------------------------------------------------------------------------------
-- The app captures photos *before* the extraction service has produced a
-- meter_readings row. Relax the consistency check so a kind='meter_reading'
-- photo can exist with meter_reading_id NULL while extraction is pending.
-- Once the extraction service writes the reading, it UPDATEs the photo's
-- meter_reading_id to link them.
--
-- A kind='unit_reference' photo MUST still have meter_reading_id NULL —
-- those are setup photos, not tied to a reading.
--------------------------------------------------------------------------------

alter table public.photos drop constraint photos_check;

alter table public.photos add constraint photos_kind_consistency check (
  kind = 'meter_reading'
  or (kind = 'unit_reference' and meter_reading_id is null)
);

-- Extraction status lets the downstream service flag failures and lets us
-- query "what's pending?" without an EXISTS join.
create type extraction_status as enum ('pending', 'extracted', 'failed');

alter table public.photos
  add column extraction_status extraction_status not null default 'pending';

create index photos_extraction_status_idx
  on public.photos (extraction_status)
  where extraction_status <> 'extracted' and deleted_at is null;

comment on column public.photos.extraction_status is
  'pending = awaiting OCR/extraction; extracted = linked to meter_readings; failed = extraction errored';
