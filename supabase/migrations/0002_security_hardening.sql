--------------------------------------------------------------------------------
-- Security hardening after the initial schema migration.
--
-- Addresses Supabase advisor findings:
--   - Views with SECURITY DEFINER calls should use security_invoker=true so
--     RLS applies to the calling user, not the view creator.
--   - SECURITY DEFINER functions and the updated_at trigger should pin
--     search_path to prevent function-shadowing attacks.
--   - handle_new_user is a trigger-only function — revoke EXECUTE from any
--     role that could call it directly via PostgREST.
--------------------------------------------------------------------------------

-- View should run with the *caller's* permissions so per-row RLS still applies.
alter view public.current_park_progress set (security_invoker = true);

-- Pin search_path on every function we own.
alter function public.set_updated_at()      set search_path = public, pg_temp;
alter function public.current_user_park_id() set search_path = public, pg_temp;
-- is_admin and handle_new_user already declare `set search_path = public`
-- in their definitions, so nothing to do for them here.

-- handle_new_user is only meant to be called by the trigger on auth.users.
-- Nothing else should be able to call it via REST or SQL.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
