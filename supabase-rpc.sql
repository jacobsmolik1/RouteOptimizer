-- ══════════════════════════════════════════════════════════════
--  CCBCU Route Optimizer — RPC functions
--  Security-definer wrappers that bypass RLS for the sb_publishable_
--  key format used in newer Supabase projects with supabase-js v2.
--  Run this in the Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── Get today's dispatch day ───────────────────────────────────
create or replace function public.get_dispatch_day(p_dc_slug text, p_date date)
returns jsonb language plpgsql security definer stable as $$
declare v_dc_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not public.user_has_dc_access(v_dc_id) then
    raise exception 'Access denied for DC: %', p_dc_slug;
  end if;
  return (
    select row_to_json(d)::jsonb
    from public.dispatch_days d
    where d.dc_id = v_dc_id and d.date = p_date
  );
end;
$$;

-- ── Save (upsert) today's dispatch day ────────────────────────
create or replace function public.save_dispatch_day(
  p_dc_slug           text,
  p_date              date,
  p_loads             jsonb default null,
  p_result            jsonb default null,
  p_settings          jsonb default null,
  p_ad_hoc            jsonb default null,
  p_bucket_assignments jsonb default null,
  p_returned          jsonb default null,
  p_what_if           jsonb default null,
  p_templates         jsonb default null
) returns void language plpgsql security definer as $$
declare v_dc_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not public.user_has_dc_access(v_dc_id) then
    raise exception 'Access denied for DC: %', p_dc_slug;
  end if;

  insert into public.dispatch_days
    (dc_id, date, loads, result, settings, ad_hoc,
     bucket_assignments, returned, what_if, templates)
  values
    (v_dc_id, p_date, p_loads, p_result, p_settings, p_ad_hoc,
     p_bucket_assignments, p_returned, p_what_if, p_templates)
  on conflict (dc_id, date) do update set
    loads              = excluded.loads,
    result             = excluded.result,
    settings           = excluded.settings,
    ad_hoc             = excluded.ad_hoc,
    bucket_assignments = excluded.bucket_assignments,
    returned           = excluded.returned,
    what_if            = excluded.what_if,
    templates          = excluded.templates,
    updated_at         = now();
end;
$$;

-- ── Get drivers for a DC ──────────────────────────────────────
create or replace function public.get_drivers_for_dc(p_dc_slug text)
returns jsonb language plpgsql security definer stable as $$
declare v_dc_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not public.user_has_dc_access(v_dc_id) then
    raise exception 'Access denied for DC: %', p_dc_slug;
  end if;
  return coalesce(
    (select json_agg(d order by d.name)::jsonb
     from public.drivers d
     where d.dc_id = v_dc_id and d.active = true),
    '[]'::jsonb
  );
end;
$$;

-- ── Commit a dispatch day (lock status) ──────────────────────
create or replace function public.commit_dispatch_day(p_dc_slug text, p_date date)
returns void language plpgsql security definer as $$
declare v_dc_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not public.user_has_dc_access(v_dc_id) then
    raise exception 'Access denied for DC: %', p_dc_slug;
  end if;

  update public.dispatch_days
  set status = 'committed', committed_at = now()
  where dc_id = v_dc_id and date = p_date;
end;
$$;

-- ── Get committed history for a DC ──────────────────────────
create or replace function public.get_history_for_dc(p_dc_slug text, p_limit int default 60)
returns jsonb language plpgsql security definer stable as $$
declare v_dc_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not public.user_has_dc_access(v_dc_id) then
    raise exception 'Access denied for DC: %', p_dc_slug;
  end if;
  return coalesce(
    (select json_agg(row_to_json(sub))::jsonb
     from (
       select date, status, committed_at, result, bucket_assignments
       from public.dispatch_days
       where dc_id = v_dc_id and status = 'committed'
       order by date desc
       limit p_limit
     ) sub),
    '[]'::jsonb
  );
end;
$$;

-- ── Save (upsert) drivers for a DC ───────────────────────────
-- Requires admin role for the calling user.
create or replace function public.save_drivers_for_dc(p_dc_slug text, p_drivers jsonb)
returns void language plpgsql security definer as $$
declare
  v_dc_id uuid;
  v_d     jsonb;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not exists (
    select 1 from public.user_dc_access
    where user_id = auth.uid()
      and dc_id   = v_dc_id
      and role    = 'admin'
  ) then
    raise exception 'Admin access required for DC: %', p_dc_slug;
  end if;

  for v_d in select * from jsonb_array_elements(p_drivers) loop
    insert into public.drivers
      (id, dc_id, name, home_base, restriction, max_loads,
       deadhead_miles, domicile_dest, on_vacation, arrival_time, notes, active)
    values (
      v_d->>'id', v_dc_id, v_d->>'name', v_d->>'home_base',
      v_d->>'restriction',
      (v_d->>'max_loads')::int,
      (v_d->>'deadhead_miles')::int,
      v_d->>'domicile_dest',
      (v_d->>'on_vacation')::boolean,
      v_d->>'arrival_time',
      v_d->>'notes',
      true
    )
    on conflict (id) do update set
      name           = excluded.name,
      home_base      = excluded.home_base,
      restriction    = excluded.restriction,
      max_loads      = excluded.max_loads,
      deadhead_miles = excluded.deadhead_miles,
      domicile_dest  = excluded.domicile_dest,
      on_vacation    = excluded.on_vacation,
      arrival_time   = excluded.arrival_time,
      notes          = excluded.notes,
      updated_at     = now();
  end loop;
end;
$$;

-- ══════════════════════════════════════════════════════════════
--  Self-service crossdock provisioning
-- ══════════════════════════════════════════════════════════════

-- ── Create a new DC (any authenticated user) ──────────────────
-- Inserts the dcs row (with full config blob) and grants the
-- creator admin access. Returns the slug.
create or replace function public.create_dc(p_slug text, p_name text, p_config jsonb)
returns text language plpgsql security definer as $$
declare v_dc_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_slug is null or length(trim(p_slug)) = 0 then raise exception 'Slug required'; end if;
  if exists (select 1 from public.dcs where slug = p_slug) then
    raise exception 'DC slug already exists: %', p_slug;
  end if;

  insert into public.dcs (slug, name, config, config_updated_at)
  values (p_slug, p_name, p_config, now())
  returning id into v_dc_id;

  insert into public.user_dc_access (user_id, dc_id, role)
  values (auth.uid(), v_dc_id, 'admin')
  on conflict (user_id, dc_id) do nothing;

  return p_slug;
end;
$$;

-- ── Save a DC's config blob (admin only) ──────────────────────
create or replace function public.save_dc_config(p_dc_slug text, p_config jsonb)
returns void language plpgsql security definer as $$
declare v_dc_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not exists (
    select 1 from public.user_dc_access
    where user_id = auth.uid() and dc_id = v_dc_id and role = 'admin'
  ) then
    raise exception 'Admin access required for DC: %', p_dc_slug;
  end if;

  update public.dcs
  set config = p_config, config_updated_at = now()
  where id = v_dc_id;
end;
$$;

-- ── List all DCs the caller can access (with config) ──────────
-- Built-in DCs return config = null (they live in code).
create or replace function public.list_accessible_dcs()
returns jsonb language plpgsql security definer stable as $$
begin
  return coalesce(
    (select json_agg(row_to_json(sub))::jsonb
     from (
       select d.slug, d.name, d.config, d.config_updated_at
       from public.dcs d
       where public.user_has_dc_access(d.id)
       order by d.name
     ) sub),
    '[]'::jsonb
  );
end;
$$;

-- ══════════════════════════════════════════════════════════════
--  Dispatcher access management (invite / list / revoke)
-- ══════════════════════════════════════════════════════════════
-- ── List members of a DC (any member can view) ────────────────
create or replace function public.list_dc_members(p_dc_slug text)
returns jsonb language plpgsql security definer stable as $$
declare v_dc_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not public.user_has_dc_access(v_dc_id) then
    raise exception 'Access denied for DC: %', p_dc_slug;
  end if;
  return coalesce(
    (select json_agg(row_to_json(sub) order by sub.role, sub.email)::jsonb
     from (
       select u.email,
              ua.role,
              (ua.user_id = auth.uid()) as is_self
       from public.user_dc_access ua
       join auth.users u on u.id = ua.user_id
       where ua.dc_id = v_dc_id
     ) sub),
    '[]'::jsonb
  );
end;
$$;

-- ── Grant access to an existing user by email (admin only) ────
create or replace function public.grant_dc_access(p_dc_slug text, p_email text, p_role text default 'dispatcher')
returns text language plpgsql security definer as $$
declare
  v_dc_id   uuid;
  v_user_id uuid;
begin
  if p_role not in ('dispatcher','admin') then raise exception 'Invalid role: %', p_role; end if;
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not exists (
    select 1 from public.user_dc_access
    where user_id = auth.uid() and dc_id = v_dc_id and role = 'admin'
  ) then
    raise exception 'Admin access required for DC: %', p_dc_slug;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No account found for %. They must sign up first.', p_email;
  end if;

  insert into public.user_dc_access (user_id, dc_id, role)
  values (v_user_id, v_dc_id, p_role)
  on conflict (user_id, dc_id) do update set role = excluded.role;

  return p_email || ' → ' || p_role;
end;
$$;

-- ── Revoke a user's access by email (admin only; not self) ────
create or replace function public.revoke_dc_access(p_dc_slug text, p_email text)
returns void language plpgsql security definer as $$
declare
  v_dc_id   uuid;
  v_user_id uuid;
begin
  select id into v_dc_id from public.dcs where slug = p_dc_slug;
  if v_dc_id is null then raise exception 'DC not found: %', p_dc_slug; end if;
  if not exists (
    select 1 from public.user_dc_access
    where user_id = auth.uid() and dc_id = v_dc_id and role = 'admin'
  ) then
    raise exception 'Admin access required for DC: %', p_dc_slug;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then raise exception 'No account found for %', p_email; end if;
  if v_user_id = auth.uid() then raise exception 'You cannot remove your own access.'; end if;

  delete from public.user_dc_access where user_id = v_user_id and dc_id = v_dc_id;
end;
$$;
