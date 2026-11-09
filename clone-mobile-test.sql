-- ══════════════════════════════════════════════════════════════
--  Clone the Mobile crossdock → "Mobile Test"
--  Run in the Supabase SQL editor (Dashboard → SQL Editor).
--
--  Copies:
--    • dcs row + full config blob (destinations, phases, restrictions,
--      optimizer, settings) with a NEW id/name/storagePrefix so the test
--      copy never shares browser localStorage with the real Mobile DC
--    • the full driver roster
--    • ADMIN access rows only (dispatchers won't see the test DC unless
--      you grant them access afterward)
--  Optional (section 2): the most recent dispatch day, re-dated to today.
--
--  Safe: aborts if the source can't be identified uniquely or if
--  "mobile-test" already exists. Nothing in the real Mobile DC is touched.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Clone DC, config, drivers, admin access ────────────────
do $$
declare
  v_src_id    uuid;
  v_src_slug  text;
  v_src_cfg   jsonb;
  v_new_id    uuid;
  v_new_slug  constant text := 'mobile-test';
  v_new_name  constant text := 'Mobile Test';
  v_count     int;
begin
  -- Find the real Mobile crossdock (a user-created DC, so config is not null).
  select count(*) into v_count
  from public.dcs
  where config is not null
    and (slug ilike '%mobile%' or name ilike '%mobile%')
    and slug <> v_new_slug;

  if v_count = 0 then
    raise exception 'No Mobile crossdock found. Check: select slug, name from public.dcs;';
  elsif v_count > 1 then
    raise exception 'More than one Mobile-like DC found (%). Set the source slug explicitly.', v_count;
  end if;

  select id, slug, config into v_src_id, v_src_slug, v_src_cfg
  from public.dcs
  where config is not null
    and (slug ilike '%mobile%' or name ilike '%mobile%')
    and slug <> v_new_slug;

  if exists (select 1 from public.dcs where slug = v_new_slug) then
    raise exception 'DC "%" already exists — delete it first or pick another slug.', v_new_slug;
  end if;

  -- New DC row with config re-keyed (id / name / storagePrefix).
  insert into public.dcs (slug, name, config, config_updated_at)
  values (
    v_new_slug,
    v_new_name,
    v_src_cfg
      || jsonb_build_object(
           'id',            v_new_slug,
           'name',          v_new_name,
           'storagePrefix', v_new_slug || '_'
         ),
    now()
  )
  returning id into v_new_id;

  -- Driver roster (ids like D001 are per-DC, so they can be reused as-is).
  insert into public.drivers
    (id, dc_id, name, home_base, restriction, max_loads, deadhead_miles,
     domicile_dest, on_vacation, arrival_time, priority, notes, active)
  select
     id, v_new_id, name, home_base, restriction, max_loads, deadhead_miles,
     domicile_dest, on_vacation, arrival_time, priority, notes, active
  from public.drivers
  where dc_id = v_src_id;

  -- Admins of Mobile become admins of Mobile Test.
  insert into public.user_dc_access (user_id, dc_id, role)
  select user_id, v_new_id, role
  from public.user_dc_access
  where dc_id = v_src_id and role = 'admin'
  on conflict (user_id, dc_id) do nothing;

  raise notice 'Cloned "%" → "%" (dc id %)', v_src_slug, v_new_slug, v_new_id;
end $$;


-- ── 2. OPTIONAL: copy Mobile's latest dispatch day as today's ──
-- Gives the test copy real loads/results to play with. Uncomment to run.
-- Note: the nightly cron reset applies to Mobile Test like any other DC.
/*
insert into public.dispatch_days
  (dc_id, date, status, loads, result, settings, ad_hoc,
   bucket_assignments, returned, what_if, templates)
select
  (select id from public.dcs where slug = 'mobile-test'),
  (now() at time zone 'America/Chicago')::date,   -- Mobile runs on Central time
  'draft', dd.loads, dd.result, dd.settings, dd.ad_hoc,
  dd.bucket_assignments, dd.returned, dd.what_if, dd.templates
from public.dispatch_days dd
join public.dcs d on d.id = dd.dc_id
where d.config is not null
  and (d.slug ilike '%mobile%' or d.name ilike '%mobile%')
  and d.slug <> 'mobile-test'
order by dd.date desc
limit 1
on conflict (dc_id, date) do nothing;
*/


-- ── 3. Verify ──────────────────────────────────────────────────
select d.slug, d.name,
       jsonb_array_length(coalesce(d.config->'destinations','[]')) as destinations,
       jsonb_array_length(coalesce(d.config->'phases','[]'))       as phases,
       (select count(*) from public.drivers x where x.dc_id = d.id) as drivers,
       (select count(*) from public.user_dc_access a where a.dc_id = d.id) as members
from public.dcs d
where d.config is not null
  and (d.slug ilike '%mobile%' or d.name ilike '%mobile%')
order by d.slug;


-- ── Cleanup (when you're done testing) ─────────────────────────
-- Access rows cascade automatically; drivers and dispatch_days don't, so
-- delete them first, in this order:
-- delete from public.dispatch_days where dc_id = (select id from public.dcs where slug='mobile-test');
-- delete from public.drivers       where dc_id = (select id from public.dcs where slug='mobile-test');
-- delete from public.dcs           where slug = 'mobile-test';
