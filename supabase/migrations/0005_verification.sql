create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments (id) on delete cascade,
  user_id uuid not null references public.users (id),
  kind text not null,
  nonce text unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments (id) on delete cascade,
  score numeric not null,
  band text not null,
  created_at timestamptz not null default now()
);

alter table public.evidence enable row level security;
alter table public.verification_events enable row level security;

create policy evidence_self on public.evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy verification_events_self on public.verification_events
  for select using (
    exists (select 1 from public.commitments c where c.id = commitment_id and c.committer_id = auth.uid())
  );
