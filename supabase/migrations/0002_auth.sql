create table if not exists public.otp_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists otp_attempts_email_idx on public.otp_attempts (email, attempted_at desc);

alter table public.otp_attempts enable row level security;
create policy otp_attempts_none on public.otp_attempts for all using (false) with check (false);

alter table public.devices add column if not exists attestation text;
