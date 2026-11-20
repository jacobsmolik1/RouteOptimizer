-- ══════════════════════════════════════════════════════════════════════════
--  Owner-only user access management (2026-11-20)
--  • app_owners: the accounts that may manage access (Jacob's two accounts)
--  • owner_* functions behind the User Access page; each refuses non-owners
--  • grant_dc_access / revoke_dc_access (per-crossdock Dispatchers screen) become owner-only
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists public.app_owners (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.app_owners enable row level security;
revoke all on public.app_owners from anon, authenticated;
insert into public.app_owners (user_id)
  select id from auth.users where lower(email) in ('jacobsmolik@ccbcu.com', 'jacobsmolik1@gmail.com')
  on conflict do nothing;

create or replace function public.am_i_owner() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.app_owners where user_id = auth.uid());
$fn$;

create or replace function public._require_owner() returns void
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not exists (select 1 from public.app_owners where user_id = auth.uid()) then
    raise exception 'Only the app owner can manage access.';
  end if;
end $fn$;

-- Everything the page shows: crossdocks, people (with access per crossdock), pending invites.
create or replace function public.owner_list_access() returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
begin
  perform public._require_owner();
  return jsonb_build_object(
    'dcs', coalesce((select jsonb_agg(jsonb_build_object('slug', d.slug, 'name', d.name) order by d.name) from public.dcs d), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
               'email', u.email, 'name', coalesce(p.full_name, ''),
               'last_sign_in', u.last_sign_in_at, 'created', u.created_at,
               'is_owner', exists (select 1 from public.app_owners o where o.user_id = u.id),
               'is_self', u.id = auth.uid(),
               'access', coalesce((select jsonb_object_agg(d.slug, a.role) from public.user_dc_access a join public.dcs d on d.id = a.dc_id where a.user_id = u.id), '{}'::jsonb)
             ) order by lower(u.email))
      from auth.users u left join public.profiles p on p.id = u.id), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('email', pi.email, 'slug', d.slug, 'role', pi.role, 'created', pi.created_at) order by pi.email, d.slug)
      from public.pending_invites pi join public.dcs d on d.id = pi.dc_id), '[]'::jsonb)
  );
end $fn$;

-- Set one person's role at one crossdock. p_role: 'dispatcher' | 'admin' | null/'' (remove).
-- No account yet → kept as a pending invite (granted automatically when they sign up).
create or replace function public.owner_set_access(p_email text, p_dc_slug text, p_role text) returns text
language plpgsql security definer set search_path = public as $fn$
declare v_email text := lower(trim(p_email)); v_dc uuid; v_user uuid; v_role text := nullif(trim(coalesce(p_role, '')), '');
begin
  perform public._require_owner();
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  if v_role is not null and v_role not in ('dispatcher', 'admin') then raise exception 'Invalid role: %', v_role; end if;
  select id into v_dc from public.dcs where slug = p_dc_slug;
  if v_dc is null then raise exception 'Crossdock not found: %', p_dc_slug; end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    if v_role is null then
      delete from public.pending_invites where lower(email) = v_email and dc_id = v_dc;
      return 'invite-removed';
    end if;
    insert into public.pending_invites (email, dc_id, role, invited_by) values (v_email, v_dc, v_role, auth.uid())
      on conflict (email, dc_id) do update set role = excluded.role;
    return 'invited';
  end if;
  if exists (select 1 from public.app_owners where user_id = v_user) and coalesce(v_role, '') <> 'admin' then
    raise exception 'Owner accounts keep admin access (so you can''t lock yourself out).';
  end if;
  if v_role is null then
    delete from public.user_dc_access where user_id = v_user and dc_id = v_dc;
    return 'removed';
  end if;
  insert into public.user_dc_access (user_id, dc_id, role) values (v_user, v_dc, v_role)
    on conflict (user_id, dc_id) do update set role = excluded.role;
  return 'granted';
end $fn$;

create or replace function public.owner_set_name(p_email text, p_name text) returns void
language plpgsql security definer set search_path = public as $fn$
declare v_user uuid;
begin
  perform public._require_owner();
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'No account for % yet. Names can be added once they sign up.', p_email; end if;
  insert into public.profiles (id, full_name) values (v_user, nullif(trim(coalesce(p_name, '')), ''))
    on conflict (id) do update set full_name = excluded.full_name;
end $fn$;

-- Make p_to_email's access exactly match p_from_email's (crossdocks and roles).
create or replace function public.owner_copy_access(p_from_email text, p_to_email text) returns integer
language plpgsql security definer set search_path = public as $fn$
declare v_from uuid; v_to uuid; v_to_email text := lower(trim(p_to_email)); n int;
begin
  perform public._require_owner();
  select id into v_from from auth.users where lower(email) = lower(trim(p_from_email));
  if v_from is null then raise exception 'No account for %.', p_from_email; end if;
  if v_to_email is null or v_to_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  if v_to_email = lower(trim(p_from_email)) then raise exception 'Pick two different people.'; end if;
  select id into v_to from auth.users where lower(email) = v_to_email;
  if v_to is not null and exists (select 1 from public.app_owners where user_id = v_to) then
    raise exception 'Owner accounts keep their own access.';
  end if;
  if v_to is null then
    delete from public.pending_invites where lower(email) = v_to_email;
    insert into public.pending_invites (email, dc_id, role, invited_by)
      select v_to_email, a.dc_id, a.role, auth.uid() from public.user_dc_access a where a.user_id = v_from;
  else
    delete from public.user_dc_access where user_id = v_to;
    insert into public.user_dc_access (user_id, dc_id, role)
      select v_to, a.dc_id, a.role from public.user_dc_access a where a.user_id = v_from;
  end if;
  select count(*) into n from public.user_dc_access where user_id = v_from;
  return n;
end $fn$;

-- Take away every crossdock (and any pending invites) for one person. The account itself stays.
create or replace function public.owner_remove_all(p_email text) returns integer
language plpgsql security definer set search_path = public as $fn$
declare v_email text := lower(trim(p_email)); v_user uuid; n int := 0; m int := 0;
begin
  perform public._require_owner();
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is not null and exists (select 1 from public.app_owners where user_id = v_user) then
    raise exception 'Owner accounts keep admin access (so you can''t lock yourself out).';
  end if;
  delete from public.pending_invites where lower(email) = v_email;
  get diagnostics m = row_count;
  if v_user is not null then
    delete from public.user_dc_access where user_id = v_user;
    get diagnostics n = row_count;
  end if;
  return n + m;
end $fn$;

-- Per-crossdock Dispatchers screen: granting / removing is now owner-only too.
create or replace function public.grant_dc_access(p_dc_slug text, p_email text, p_role text default 'dispatcher') returns text
language plpgsql security definer set search_path = public as $fn$
declare r text;
begin
  perform public._require_owner();
  r := public.owner_set_access(p_email, p_dc_slug, coalesce(p_role, 'dispatcher'));
  return case when r = 'invited' then 'pending:' || lower(trim(p_email)) else 'granted:' || p_email || ' → ' || p_role end;
end $fn$;

create or replace function public.revoke_dc_access(p_dc_slug text, p_email text) returns void
language plpgsql security definer set search_path = public as $fn$
declare v_user uuid;
begin
  perform public._require_owner();
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user = auth.uid() then raise exception 'You cannot remove your own access.'; end if;
  perform public.owner_set_access(p_email, p_dc_slug, null);
end $fn$;

grant execute on function public.am_i_owner(), public.owner_list_access(), public.owner_set_access(text, text, text),
  public.owner_set_name(text, text), public.owner_copy_access(text, text), public.owner_remove_all(text) to authenticated;
