create type commitment_state as enum (
  'draft','pending_acceptance','funding','scheduled','active',
  'verification_pending','success','failure','disputed','resolved',
  'cancelled','voided','expired'
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 100,
  source text not null check (source in ('seeded','captured','google')),
  created_at timestamptz not null default now()
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  committer_id uuid not null references public.users (id),
  state commitment_state not null default 'draft',
  spec jsonb not null,
  invite_code text unique,
  reservation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commitment_participants (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments (id) on delete cascade,
  user_id uuid references public.users (id),
  role text not null,
  status text not null default 'invited'
);

create table if not exists public.wallets (
  user_id uuid primary key references public.users (id) on delete cascade,
  currency text not null default 'POINTS',
  available_minor bigint not null default 10000,
  reserved_minor bigint not null default 0
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_user_id uuid not null references public.wallets (user_id),
  currency text not null,
  minor bigint not null,
  direction text not null check (direction in ('debit','credit')),
  ref text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid references public.commitments (id),
  status text not null default 'unwritten'
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'unwritten'
);

alter table public.places enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_participants enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;

create policy places_read on public.places for select using (true);
create policy commitments_self on public.commitments
  for all using (committer_id = auth.uid()) with check (committer_id = auth.uid());
create policy participants_self on public.commitment_participants
  for select using (user_id = auth.uid());
create policy wallets_self on public.wallets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ledger_self on public.ledger_entries
  for select using (wallet_user_id = auth.uid());
create policy payments_none on public.payments for all using (false);
create policy payouts_none on public.payouts for all using (false);

insert into public.places (name, lat, lng, radius_m, source) values
  ('Babson Recreation Center', 42.296, -71.266, 120, 'seeded'),
  ('Horn Library', 42.298, -71.266, 80, 'seeded'),
  ('Trim Dining Hall', 42.297, -71.264, 80, 'seeded'),
  ('Reynolds Campus Center', 42.2975, -71.265, 90, 'seeded'),
  ('Forest Hall', 42.299, -71.263, 70, 'seeded')
on conflict do nothing;
