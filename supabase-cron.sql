-- ══════════════════════════════════════════════════════════════
--  Server-side nightly dispatch rollover  (pg_cron)
--  Runs for ALL crossdocks every night, independent of whether anyone opens
--  that DC. Does two things:
--    1. COMMIT — records every crossdock's finished day in the History log.
--    2. RESET  — gives every crossdock a fresh empty day (all load counts 0)
--                for the new date, so the dispatch sheet clears daily everywhere.
--  The client-side rollover only ever fired for DCs someone actually opened on an
--  up-to-date app, so unopened crossdocks (Birmingham, Mobile, …) never reset and
--  their days never got recorded. This job is the reliable backstop.
-- ══════════════════════════════════════════════════════════════

-- Requires the pg_cron extension (enable once):
create extension if not exists pg_cron;

create or replace function public.rollover_all_dcs() returns integer language plpgsql security definer as $$
declare v_count integer; r record;
begin
  -- 1) Commit every DC's past worked days (draft + a real generated result). Never touches
  --    today's in-progress plan (date < current_date) or already-committed days.
  update public.dispatch_days set status='committed', committed_at=now()
  where status='draft' and result is not null
    and jsonb_array_length(coalesce(result->'assignments','[]'::jsonb)) > 0
    and date < current_date;
  get diagnostics v_count = row_count;

  -- 2) Reset: ensure EVERY DC has a fresh empty day (all load counts 0) for today.
  --    Zero-length matches the DC's phase count. Never clobbers a day already started
  --    (on conflict do nothing), so an early-morning in-progress plan is safe.
  for r in
    select d.id as dc_id,
           coalesce(jsonb_array_length(d.config->'phases'),
                    (select jsonb_array_length(dd.loads) from public.dispatch_days dd
                       where dd.dc_id=d.id and dd.loads is not null order by dd.date desc limit 1),
                    5) as n
    from public.dcs d
  loop
    insert into public.dispatch_days (dc_id, date, status, loads, result, ad_hoc, bucket_assignments, returned, what_if, updated_at)
    values (r.dc_id, current_date, 'draft',
            (select jsonb_agg(0) from generate_series(1, r.n)),
            null, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, now())
    on conflict (dc_id, date) do nothing;
  end loop;

  return v_count;
end;
$$;

-- Schedule nightly at 08:00 UTC (~3 AM Central / 4 AM Eastern — after the day's
-- deliveries are done, before the next workday). Re-running unschedule+schedule is safe.
-- select cron.unschedule('nightly-dispatch-rollover');
select cron.schedule('nightly-dispatch-rollover', '0 8 * * *', $$select public.rollover_all_dcs()$$);

-- One-time backfill / manual run (commits missed days + resets any DC lacking today's row):
-- select public.rollover_all_dcs();
