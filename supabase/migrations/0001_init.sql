-- Phase 0 foundation. RLS on every user table. Never disable it.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  phone_e164 text unique,
  phone_verified_at timestamptz,
  date_of_birth date,
  country_code text not null default 'US',
  region_code text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'self_excluded', 'deleted')),
  self_excluded_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  display_name text not null,
  username text unique,
  avatar_url text,
  bio text,
  timezone text not null default 'America/New_York',
  default_visibility text not null default 'partners_only',
  score integer not null default 500,
  score_updated_at timestamptz,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  total_commitments integer not null default 0,
  total_completed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  push_token text,
  attestation text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_pct integer not null default 0 check (rollout_pct between 0 and 100),
  updated_at timestamptz not null default now()
);

create index if not exists users_status_idx on public.users (status) where status <> 'active';
create index if not exists devices_user_idx on public.devices (user_id);
create index if not exists analytics_user_idx on public.analytics_events (user_id, occurred_at desc);

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.analytics_events enable row level security;
alter table public.error_events enable row level security;
alter table public.feature_flags enable row level security;

create policy users_self_select on public.users
  for select using (id = auth.uid());
create policy users_self_update on public.users
  for update using (id = auth.uid());

create policy profiles_self_select on public.profiles
  for select using (user_id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (user_id = auth.uid());
create policy profiles_self_insert on public.profiles
  for insert with check (user_id = auth.uid());

create policy devices_self_all on public.devices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy analytics_self_insert on public.analytics_events
  for insert with check (user_id = auth.uid() or user_id is null);
create policy analytics_self_select on public.analytics_events
  for select using (user_id = auth.uid());

create policy error_events_no_client on public.error_events
  for all using (false) with check (false);

create policy feature_flags_read on public.feature_flags
  for select using (true);

insert into public.feature_flags (key, enabled, rollout_pct)
values
  ('payments', false, 0),
  ('verification', false, 0),
  ('ai_composer', true, 100),
  ('settlement_paused', false, 0)
on conflict (key) do nothing;
