-- supabase/migrations/create_push_subscriptions.sql

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table public.push_subscriptions enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can manage their own subscriptions" on public.push_subscriptions;
drop policy if exists "Service role bypass for admin notifications" on public.push_subscriptions;

-- RLS Policies
create policy "Users can manage their own subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role bypass for admin notifications"
  on public.push_subscriptions
  for all
  using (true);
