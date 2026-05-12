--------------------------------------------------------------------------------
-- Performance cleanup:
--   * Wrap auth.uid() in subqueries so PG evaluates it once per query
--     (advisor: auth_rls_initplan)
--   * Consolidate per-table policies so there's at most one PERMISSIVE policy
--     per (role, action) — fixes multiple_permissive_policies on every table
--   * Add covering indexes for the four foreign keys that didn't have one
--------------------------------------------------------------------------------

-- Drop the original RLS policies (defined in 0001_initial_schema) -------------

drop policy "profiles: self or admin can read"               on public.profiles;
drop policy "profiles: self can update own non-role fields"  on public.profiles;
drop policy "profiles: admin full control"                   on public.profiles;

drop policy "parks: readers see only their assigned park"    on public.parks;
drop policy "parks: admin writes"                            on public.parks;

drop policy "units: scoped to assigned park"                 on public.units;
drop policy "units: admin writes"                            on public.units;

drop policy "unit_meters: scoped via unit"                   on public.unit_meters;
drop policy "unit_meters: admin writes"                      on public.unit_meters;

drop policy "park_assignments: read own or admin"            on public.park_assignments;
drop policy "park_assignments: admin writes"                 on public.park_assignments;

drop policy "meter_readings: scoped read"                    on public.meter_readings;
drop policy "meter_readings: readers insert for own assignment"
  on public.meter_readings;
drop policy "meter_readings: admin update"                   on public.meter_readings;
drop policy "meter_readings: admin delete"                   on public.meter_readings;

drop policy "photos: scoped read"                            on public.photos;
drop policy "photos: readers insert for own assignment"      on public.photos;
drop policy "photos: admin update/delete"                    on public.photos;

-- Recreate with one policy per (table, action) and pinned auth.uid() ---------

-- profiles -------------------------------------------------------------------

create policy "profiles_select"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles_update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (
    public.is_admin()
    or (
      id = (select auth.uid())
      and role = (select role from public.profiles where id = (select auth.uid()))
    )
  );

create policy "profiles_admin_insert"
  on public.profiles for insert to authenticated
  with check (public.is_admin());

create policy "profiles_admin_delete"
  on public.profiles for delete to authenticated
  using (public.is_admin());

-- parks ----------------------------------------------------------------------

create policy "parks_select"
  on public.parks for select to authenticated
  using (public.is_admin() or id = public.current_user_park_id());

create policy "parks_admin_insert"
  on public.parks for insert to authenticated
  with check (public.is_admin());

create policy "parks_admin_update"
  on public.parks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "parks_admin_delete"
  on public.parks for delete to authenticated
  using (public.is_admin());

-- units ----------------------------------------------------------------------

create policy "units_select"
  on public.units for select to authenticated
  using (public.is_admin() or park_id = public.current_user_park_id());

create policy "units_admin_insert"
  on public.units for insert to authenticated
  with check (public.is_admin());

create policy "units_admin_update"
  on public.units for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "units_admin_delete"
  on public.units for delete to authenticated
  using (public.is_admin());

-- unit_meters ----------------------------------------------------------------

create policy "unit_meters_select"
  on public.unit_meters for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.units u
      where u.id = unit_id and u.park_id = public.current_user_park_id()
    )
  );

create policy "unit_meters_admin_insert"
  on public.unit_meters for insert to authenticated
  with check (public.is_admin());

create policy "unit_meters_admin_update"
  on public.unit_meters for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "unit_meters_admin_delete"
  on public.unit_meters for delete to authenticated
  using (public.is_admin());

-- park_assignments -----------------------------------------------------------

create policy "park_assignments_select"
  on public.park_assignments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "park_assignments_admin_insert"
  on public.park_assignments for insert to authenticated
  with check (public.is_admin());

create policy "park_assignments_admin_update"
  on public.park_assignments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "park_assignments_admin_delete"
  on public.park_assignments for delete to authenticated
  using (public.is_admin());

-- meter_readings -------------------------------------------------------------

create policy "meter_readings_select"
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

-- Admins may insert with any captured_by; readers must record themselves.
create policy "meter_readings_insert"
  on public.meter_readings for insert to authenticated
  with check (
    public.is_admin()
    or (
      captured_by = (select auth.uid())
      and exists (
        select 1
        from public.unit_meters um
        join public.units u on u.id = um.unit_id
        where um.id = unit_meter_id
          and u.park_id = public.current_user_park_id()
      )
    )
  );

create policy "meter_readings_admin_update"
  on public.meter_readings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "meter_readings_admin_delete"
  on public.meter_readings for delete to authenticated
  using (public.is_admin());

-- photos ---------------------------------------------------------------------

create policy "photos_select"
  on public.photos for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.units u
      where u.id = unit_id and u.park_id = public.current_user_park_id()
    )
  );

create policy "photos_insert"
  on public.photos for insert to authenticated
  with check (
    public.is_admin()
    or (
      captured_by = (select auth.uid())
      and exists (
        select 1 from public.units u
        where u.id = unit_id and u.park_id = public.current_user_park_id()
      )
    )
  );

create policy "photos_admin_update"
  on public.photos for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "photos_admin_delete"
  on public.photos for delete to authenticated
  using (public.is_admin());

-- Covering indexes for unindexed foreign keys --------------------------------

create index meter_readings_superseded_by_idx
  on public.meter_readings (superseded_by) where superseded_by is not null;

create index meter_readings_superseded_by_user_idx
  on public.meter_readings (superseded_by_user) where superseded_by_user is not null;

create index park_assignments_assigned_by_idx
  on public.park_assignments (assigned_by) where assigned_by is not null;

create index photos_captured_by_idx
  on public.photos (captured_by);
