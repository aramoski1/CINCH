-- Shared product snapshot so a hosted API (and serverless instances) share one store.
-- Service role bypasses RLS. Clients never read this table.

create table if not exists public.cinch_runtime (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cinch_runtime enable row level security;

drop policy if exists cinch_runtime_none on public.cinch_runtime;
create policy cinch_runtime_none on public.cinch_runtime
  for all using (false) with check (false);
