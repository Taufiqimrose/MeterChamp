--------------------------------------------------------------------------------
-- Meter Champ — initial schema
--
-- Design principles:
--   1. Meter readings are append-only. Corrections go through `superseded_by`,
--      never UPDATE/DELETE — preserves chain of custody.
--   2. Every reading carries forensic context (who, when, where, with what app)
--      so disputes are resolvable from the row alone.
--   3. RLS scopes readers to the park they're currently assigned to.
--      Admins see everything.
--   4. Photos live in S3; this DB only holds metadata + provenance.
--------------------------------------------------------------------------------

-- Extensions ------------------------------------------------------------------

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- Enums -----------------------------------------------------------------------

-- Use enums for tight integrity. Add new types later with:
--   ALTER TYPE meter_type ADD VALUE 'sewage';
create type meter_type as enum ('water', 'gas', 'electric');
create type photo_kind as enum ('unit_reference', 'meter_reading');
create type user_role as enum ('reader', 'admin');

-- updated_at trigger helper ---------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

--------------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
--------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'reader',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a Supabase auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

--------------------------------------------------------------------------------
-- parks
--------------------------------------------------------------------------------

create table public.parks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger parks_set_updated_at
  before update on public.parks
  for each row execute function public.set_updated_at();

--------------------------------------------------------------------------------
-- units (lots / sites within a park)
--------------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete restrict,
  label text not null,            -- e.g. "#047", "Lot 12"
  street_address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, label)
);

create index units_park_idx on public.units (park_id) where active;

create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

--------------------------------------------------------------------------------
-- unit_meters (which meters live on a given unit — the "flexibility" piece)
--------------------------------------------------------------------------------

create table public.unit_meters (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  meter_type meter_type not null,
  serial_label text,              -- nullable; needed only when a unit has two of the same type
  unit_of_measure text not null,  -- 'kWh' | 'm3' | 'gal' | 'ccf' | ...
  installed_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A unit can have multiple meters of the same type only if they have
  -- distinct serial_labels.
  unique (unit_id, meter_type, serial_label)
);

create index unit_meters_unit_idx on public.unit_meters (unit_id) where active;

create trigger unit_meters_set_updated_at
  before update on public.unit_meters
  for each row execute function public.set_updated_at();

--------------------------------------------------------------------------------
-- park_assignments — who's reading which park (historical)
--
-- Only one active assignment per user (enforced via partial unique index).
-- Closing an assignment = set unassigned_at, then insert a new row for the
-- new park.
--------------------------------------------------------------------------------

create table public.park_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  park_id uuid not null references public.parks(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  assigned_by uuid references auth.users(id),
  notes text,
  check (unassigned_at is null or unassigned_at >= assigned_at)
);

create unique index park_assignments_active_per_user
  on public.park_assignments (user_id) where unassigned_at is null;

create index park_assignments_park_idx
  on public.park_assignments (park_id, assigned_at desc);

--------------------------------------------------------------------------------
-- meter_readings — append-only, audit-rich
--------------------------------------------------------------------------------

create table public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  unit_meter_id uuid not null references public.unit_meters(id) on delete restrict,
  value numeric(14, 3) not null,
  captured_at timestamptz not null default now(),
  captured_by uuid not null references auth.users(id) on delete restrict,

  -- Forensic context
  gps_lat numeric(9, 6),
  gps_lng numeric(9, 6),
  gps_accuracy_m numeric(8, 2),
  device_user_agent text,
  app_version text,
  quality_score numeric(5, 4),   -- 0..1 from the on-device IQA model

  notes text,
  flagged boolean not null default false,   -- "looks wrong, please review"

  -- Append-only correction trail
  superseded_by uuid references public.meter_readings(id),
  superseded_at timestamptz,
  superseded_by_user uuid references auth.users(id),
  supersede_reason text,

  created_at timestamptz not null default now(),
  check (
    (superseded_by is null and superseded_at is null and superseded_by_user is null)
    or (superseded_by is not null and superseded_at is not null and superseded_by_user is not null)
  )
);

create index meter_readings_unit_meter_captured
  on public.meter_readings (unit_meter_id, captured_at desc);

create index meter_readings_captured_by
  on public.meter_readings (captured_by, captured_at desc);

create index meter_readings_active
  on public.meter_readings (unit_meter_id, captured_at desc)
  where superseded_by is null;

--------------------------------------------------------------------------------
-- photos — S3 metadata only
--
-- One row per upload. unit_id is required so every photo can be traced back
-- to the unit it documents; meter_reading_id is set only for proof-of-reading
-- photos.
--------------------------------------------------------------------------------

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  meter_reading_id uuid references public.meter_readings(id) on delete restrict,
  kind photo_kind not null,
  s3_bucket text not null,
  s3_key text not null,
  mime_type text not null,
  size_bytes bigint,
  width int,
  height int,
  captured_at timestamptz not null default now(),
  captured_by uuid not null references auth.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (s3_bucket, s3_key),
  -- A meter_reading photo must declare it; a unit_reference must not link a reading.
  check (
    (kind = 'meter_reading' and meter_reading_id is not null)
    or (kind = 'unit_reference' and meter_reading_id is null)
  )
);

create index photos_unit_idx on public.photos (unit_id) where deleted_at is null;
create index photos_reading_idx
  on public.photos (meter_reading_id)
  where meter_reading_id is not null and deleted_at is null;

--------------------------------------------------------------------------------
-- Helper functions used by RLS policies
--------------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.current_user_park_id()
returns uuid
language sql
stable
as $$
  select park_id
  from public.park_assignments
  where user_id = auth.uid()
    and unassigned_at is null
  order by assigned_at desc
  limit 1;
$$;

--------------------------------------------------------------------------------
-- RLS — enable on every table, then layer policies
--------------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.parks            enable row level security;
alter table public.units            enable row level security;
alter table public.unit_meters      enable row level security;
alter table public.park_assignments enable row level security;
alter table public.meter_readings   enable row level security;
alter table public.photos           enable row level security;

-- profiles --------------------------------------------------------------------

create policy "profiles: self or admin can read"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: self can update own non-role fields"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles: admin full control"
  on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- parks -----------------------------------------------------------------------

create policy "parks: readers see only their assigned park"
  on public.parks for select to authenticated
  using (public.is_admin() or id = public.current_user_park_id());

create policy "parks: admin writes"
  on public.parks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- units -----------------------------------------------------------------------

create policy "units: scoped to assigned park"
  on public.units for select to authenticated
  using (public.is_admin() or park_id = public.current_user_park_id());

create policy "units: admin writes"
  on public.units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- unit_meters -----------------------------------------------------------------

create policy "unit_meters: scoped via unit"
  on public.unit_meters for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.units u
      where u.id = unit_id and u.park_id = public.current_user_park_id()
    )
  );

create policy "unit_meters: admin writes"
  on public.unit_meters for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- park_assignments ------------------------------------------------------------

create policy "park_assignments: read own or admin"
  on public.park_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "park_assignments: admin writes"
  on public.park_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- meter_readings — append-only for readers, full power for admins ------------

create policy "meter_readings: scoped read"
  on public.meter_readings for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.unit_meters um
      join public.units u on u.id = um.unit_id
      where um.id = unit_meter_id
        and u.park_id = public.current_user_park_id()
    )
  );

create policy "meter_readings: readers insert for own assignment"
  on public.meter_readings for insert to authenticated
  with check (
    captured_by = auth.uid()
    and exists (
      select 1
      from public.unit_meters um
      join public.units u on u.id = um.unit_id
      where um.id = unit_meter_id
        and u.park_id = public.current_user_park_id()
    )
  );

-- NO update / delete policies for readers → RLS blocks both by default.
create policy "meter_readings: admin update"
  on public.meter_readings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "meter_readings: admin delete"
  on public.meter_readings for delete to authenticated
  using (public.is_admin());

-- photos ----------------------------------------------------------------------

create policy "photos: scoped read"
  on public.photos for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.units u
      where u.id = unit_id and u.park_id = public.current_user_park_id()
    )
  );

create policy "photos: readers insert for own assignment"
  on public.photos for insert to authenticated
  with check (
    captured_by = auth.uid()
    and exists (
      select 1 from public.units u
      where u.id = unit_id and u.park_id = public.current_user_park_id()
    )
  );

create policy "photos: admin update/delete (soft via deleted_at preferred)"
  on public.photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

--------------------------------------------------------------------------------
-- Convenience view: progress for current dashboard ("12 of 100 meters read")
--
-- Counts distinct unit_meters with at least one non-superseded reading in the
-- current calendar month, per active park assignment.
--------------------------------------------------------------------------------

create or replace view public.current_park_progress as
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
    select count(distinct mr.unit_meter_id)
    from public.meter_readings mr
    join public.unit_meters um on um.id = mr.unit_meter_id
    join public.units u on u.id = um.unit_id
    where u.park_id = pa.park_id
      and mr.captured_at >= date_trunc('month', now())
      and mr.superseded_by is null
  ) as readings_this_month
from public.park_assignments pa
join public.parks p on p.id = pa.park_id
where pa.unassigned_at is null;
