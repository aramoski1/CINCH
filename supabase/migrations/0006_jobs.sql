create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  payload jsonb not null,
  run_at timestamptz not null,
  idempotency_key text not null unique,
  status text not null default 'pending'
);

create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.scheduled_jobs enable row level security;
alter table public.outbox_events enable row level security;
create policy scheduled_jobs_none on public.scheduled_jobs for all using (false);
create policy outbox_none on public.outbox_events for all using (false);
