create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments (id),
  opened_by uuid not null references public.users (id),
  state text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.streaks (
  user_id uuid primary key references public.users (id),
  current integer not null default 0,
  freezes_used integer not null default 0,
  month date not null default date_trunc('month', now())::date
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups (id) on delete cascade,
  user_id uuid references public.users (id) on delete cascade,
  primary key (group_id, user_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.disputes enable row level security;
alter table public.reputation_events enable row level security;
alter table public.streaks enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.audit_logs enable row level security;

create policy disputes_self on public.disputes
  for select using (opened_by = auth.uid());
create policy reputation_self on public.reputation_events
  for select using (user_id = auth.uid());
create policy streaks_self on public.streaks
  for select using (user_id = auth.uid());
create policy groups_read on public.groups for select using (true);
create policy group_members_self on public.group_members
  for select using (user_id = auth.uid());
create policy audit_none on public.audit_logs for all using (false);
