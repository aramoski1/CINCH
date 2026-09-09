create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users (id) on delete cascade,
  user_b uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending',
  requested_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  constraint ordered_pair check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  user_id uuid not null references public.users (id),
  emoji text not null
);

alter table public.friendships enable row level security;
alter table public.feed_items enable row level security;
alter table public.reactions enable row level security;

create policy friendships_self on public.friendships
  for all using (user_a = auth.uid() or user_b = auth.uid());
create policy feed_read on public.feed_items for select using (true);
create policy reactions_self on public.reactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
