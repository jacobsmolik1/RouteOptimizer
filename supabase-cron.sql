-- ══════════════════════════════════════════════════════════════
--  Server-side nightly dispatch rollover  (pg_cron)
--  Commits every crossdock's finished day so the History log records it —
--  independent of whether anyone opens that DC. The client-side rollover only
--  ever fires for DCs someone actually opens, so days for unopened crossdocks
--  (and any day where the client commit silently failed) never got recorded.
--  This job is the reliable backstop that runs for ALL crossdocks every night.
-- ══════════════════════════════════════════════════════════════

-- Requires the pg_cron extension (enable once):
create extension if not exists pg_cron;

-- Commit every DC's past worked days (draft + a real generated result). Never touches
-- today's in-progress plan (date < current_date) or already-committed days.
create or replace function public.rollover_all_dcs() returns integer language plpgsql security definer as $$
declare v_count integer;
begin
  update public.dispatch_days
  set status = 'committed', committed_at = now()
  where status = 'draft'
    and result is not null
    and jsonb_array_length(coalesce(result->'assignments','[]'::jsonb)) > 0
    and date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Schedule nightly at 08:00 UTC (~3 AM Central / 4 AM Eastern — after the day's
-- deliveries are done, before the next workday). Re-running unschedule+schedule is safe.
-- select cron.unschedule('nightly-dispatch-rollover');
select cron.schedule('nightly-dispatch-rollover', '0 8 * * *', $$select public.rollover_all_dcs()$$);

-- One-time backfill of days that were missed before this job existed:
-- select public.rollover_all_dcs();
