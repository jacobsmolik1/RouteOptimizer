-- ══════════════════════════════════════════════════════════════
--  CCBCU Route Optimizer — Supabase Schema
--  Run this in the Supabase SQL editor (Dashboard → SQL Editor).
--  Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ══════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── DCs ───────────────────────────────────────────────────────
-- One row per distribution center.
create table if not exists public.dcs (
  id         uuid        primary key default uuid_generate_v4(),
  slug       text        unique not null,   -- matches DC_CONFIG.id in the HTML
  name       text        not null,
  created_at timestamptz default now()
);

-- Seed DCs (safe to re-run — does nothing if row exists).
insert into public.dcs (slug, name)
values ('montgomery', 'Montgomery DC')
on conflict (slug) do nothing;

insert into public.dcs (slug, name)
values ('tifton', 'Tifton Crossdock')
on conflict (slug) do nothing;

insert into public.dcs (slug, name)
values ('birmingham', 'Birmingham DC')
on conflict (slug) do nothing;

-- Config storage for self-service (user-created) DCs. Built-in DCs keep
-- config = null and live in code (ALL_DC_CONFIGS); user-created crossdocks
-- store their full config blob here so it syncs across devices/dispatchers.
alter table public.dcs add column if not exists config             jsonb;
alter table public.dcs add column if not exists config_updated_at  timestamptz default now();

-- ── Profiles ──────────────────────────────────────────────────
-- Extends auth.users — created automatically on signup via trigger.
create table if not exists public.profiles (
  id         uuid        primary key references auth.users on delete cascade,
  full_name  text,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── User ↔ DC access ──────────────────────────────────────────
-- Controls which dispatchers can access which DCs and at what role.
create table if not exists public.user_dc_access (
  user_id uuid references public.profiles on delete cascade,
  dc_id   uuid references public.dcs      on delete cascade,
  role    text not null default 'dispatcher'
            check (role in ('dispatcher', 'admin')),
  primary key (user_id, dc_id)
);

-- ── Drivers ───────────────────────────────────────────────────
-- Roster per DC. Synced to/from the app on startup.
-- IDs keep the legacy D001..D019 format for backwards compat.
create table if not exists public.drivers (
  id              text        primary key,         -- e.g. 'D001'
  dc_id           uuid        not null references public.dcs,
  name            text        not null,
  home_base       text,
  restriction     text        not null default 'Any',
  max_loads       int         not null default 3,
  deadhead_miles  int         default 0,
  domicile_dest   text,
  on_vacation     boolean     default false,
  arrival_time    text,
  priority        int         not null default 1,   -- dispatch tier: 1 = fill first, higher = overflow
  notes           text,
  active          boolean     default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Backfill for existing databases (safe to re-run).
alter table public.drivers add column if not exists priority int not null default 1;

-- ── Dispatch days ─────────────────────────────────────────────
-- One row per DC per calendar date. Working state stored as JSONB
-- blobs matching the existing localStorage key structure.
create table if not exists public.dispatch_days (
  id                 uuid        primary key default uuid_generate_v4(),
  dc_id              uuid        not null references public.dcs,
  date               date        not null,
  status             text        not null default 'draft'
                       check (status in ('draft', 'committed')),
  loads              jsonb,
  result             jsonb,
  settings           jsonb,
  ad_hoc             jsonb,
  bucket_assignments jsonb,
  returned           jsonb,
  what_if            jsonb,
  templates          jsonb,
  created_by         uuid        references public.profiles,
  committed_at       timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (dc_id, date)
);

-- ── updated_at triggers ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists drivers_updated_at       on public.drivers;
drop trigger if exists dispatch_days_updated_at on public.dispatch_days;

create trigger drivers_updated_at
  before update on public.drivers
  for each row execute procedure public.set_updated_at();

create trigger dispatch_days_updated_at
  before update on public.dispatch_days
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────
alter table public.dcs             enable row level security;
alter table public.profiles        enable row level security;
alter table public.user_dc_access  enable row level security;
alter table public.drivers         enable row level security;
alter table public.dispatch_days   enable row level security;

-- Helper: returns true if the current user has any access to a DC.
create or replace function public.user_has_dc_access(p_dc_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_dc_access
    where user_id = auth.uid() and dc_id = p_dc_id
  );
$$;

-- Profiles: users can only read/write their own row.
drop policy if exists "profiles: own row"        on public.profiles;
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id);

-- user_dc_access: users can read their own access rows.
drop policy if exists "user_dc_access: own rows" on public.user_dc_access;
create policy "user_dc_access: own rows" on public.user_dc_access
  for select using (auth.uid() = user_id);

-- DCs: readable if the user has an access row for it.
drop policy if exists "dcs: accessible"          on public.dcs;
create policy "dcs: accessible" on public.dcs
  for select using (public.user_has_dc_access(id));

-- Drivers: any DC member can read; only admins can write.
drop policy if exists "drivers: dc read"         on public.drivers;
drop policy if exists "drivers: dc admin write"  on public.drivers;

create policy "drivers: dc read" on public.drivers
  for select using (public.user_has_dc_access(dc_id));

create policy "drivers: dc admin write" on public.drivers
  for all using (
    exists (
      select 1 from public.user_dc_access
      where user_id = auth.uid()
        and dc_id   = drivers.dc_id
        and role    = 'admin'
    )
  );

-- Dispatch days: any DC member can read and write their DC's days.
drop policy if exists "dispatch_days: dc access" on public.dispatch_days;
create policy "dispatch_days: dc access" on public.dispatch_days
  for all using (public.user_has_dc_access(dc_id));

-- ══════════════════════════════════════════════════════════════
--  SETUP: Add a dispatcher to a DC
--  Run this after creating the user in Supabase Auth.
--
--  Replace the email and DC slug with real values:
--
--    insert into public.user_dc_access (user_id, dc_id, role)
--    select p.id, d.id, 'dispatcher'
--    from public.profiles p, public.dcs d
--    where p.id = (select id from auth.users where email = 'dispatcher@example.com')
--      and d.slug = 'montgomery';
--
--  For an admin (can edit driver roster):
--
--    insert into public.user_dc_access (user_id, dc_id, role)
--    select p.id, d.id, 'admin'
--    from public.profiles p, public.dcs d
--    where p.id = (select id from auth.users where email = 'admin@example.com')
--      and d.slug = 'montgomery';
--
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  OPTIONAL: Seed Montgomery driver roster
--  Run this after adding the DC row above.
--  Uses the legacy D001..D019 IDs for backwards compat.
-- ══════════════════════════════════════════════════════════════

insert into public.drivers
  (id, dc_id, name, home_base, restriction, max_loads, deadhead_miles, domicile_dest, arrival_time, notes)
select v.id, d.id, v.name, v.home_base, v.restriction, v.max_loads, v.deadhead_miles, v.domicile_dest, v.arrival_time, v.notes
from (values
  ('D001','JR Mesi',            'Panama City, FL','Panama City ONLY',1,188,'PAN','',   'Panama City ONLY · 1 load/day · 188mi deadhead'),
  ('D002','Marcus Hood',        'Columbus, GA',   'Columbus ONLY',   2,105,'COL','',   'Columbus ONLY · 2 loads/day · 105mi deadhead'),
  ('D018','Robert Pride',       'Columbus, GA',   'Columbus ONLY',   2,105,'COL','',   'Columbus ONLY · 2 loads/day · 105mi deadhead'),
  ('D013','Mcarthure Newman II','Dothan, AL',     'Any',             3,104,'DOT','10:30','Domicile: Dothan · 104mi deadhead'),
  ('D017','Wilmer Mixon',       'Evergreen, AL',  'Any',             3,78, 'EVG','11:00','Domicile: Evergreen · 78mi deadhead'),
  ('D005','Charles Carmack',    'Montgomery, AL', 'Any',             3,0,  '',  '11:30',''),
  ('D012','Javoris Williams',   'Montgomery, AL', 'Any',             3,0,  '',  '12:00',''),
  ('D014','Michael Cook',       'Montgomery, AL', 'Any',             3,0,  '',  '12:00','Training Brittnee Woods'),
  ('D019','Brittnee Woods',     'Montgomery, AL', 'Any',             3,0,  '',  '12:00','Trainee — mirrors Cook'),
  ('D009','Elkanie Moorer',     'Montgomery, AL', 'Any',             3,0,  '',  '12:30','(Bug)'),
  ('D016','Sean Tellis',        'Montgomery, AL', 'Any',             3,0,  '',  '12:30',''),
  ('D011','James Gilmore',      'Auburn, AL',     'Any',             3,55, 'AUB','12:30','Domicile: Auburn · 55mi deadhead'),
  ('D003','Aaron Smith',        'Montgomery, AL', 'Any',             3,0,  '',  '13:00',''),
  ('D006','Chauma Bowman',      'Montgomery, AL', 'Any',             3,0,  '',  '13:30',''),
  ('D015','Quad Whatley',       'Montgomery, AL', 'Any',             3,0,  '',  '13:30',''),
  ('D008','David Gadsden',      'Montgomery, AL', 'Any',             3,0,  '',  '14:00',''),
  ('D007','Cleveland Gamble',   'Montgomery, AL', 'Any',             3,0,  '',  '14:00',''),
  ('D010','Frederick Young',    'Montgomery, AL', 'Any',             3,0,  '',  '14:00',''),
  ('D004','Braxton Parker',     'Montgomery, AL', 'Any',             3,0,  '',  '17:00','Backup · last dispatch')
) as v(id, name, home_base, restriction, max_loads, deadhead_miles, domicile_dest, arrival_time, notes)
cross join (select id from public.dcs where slug = 'montgomery') d
on conflict (id) do nothing;
