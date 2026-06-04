-- Cinephile's Diary — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor

-- ──────────────────────────────────────────────
-- 1. PROFILES (auto-created on signup)
-- ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ──────────────────────────────────────────────
-- 2. CINEMA LOGS (한줄평 + 별점, 영화별 1개)
-- ──────────────────────────────────────────────
create table if not exists public.cinema_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  movie_cd text not null,
  movie_nm text not null,
  rating numeric(2,1) check (rating >= 0 and rating <= 5),
  comment text,
  saved_at timestamptz default now(),
  unique(user_id, movie_cd)
);

alter table public.cinema_logs enable row level security;

create policy "cinema_logs_all_own" on public.cinema_logs
  for all using (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 3. DIARY ENTRIES (다이어리 전문)
-- ──────────────────────────────────────────────
create table if not exists public.diary_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  local_id text not null,
  title text not null,
  watch_date date,
  context text,
  emotion text,
  content text not null,
  saved_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, local_id)
);

alter table public.diary_entries enable row level security;

create policy "diary_entries_all_own" on public.diary_entries
  for all using (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 4. TICKETS (디지털 티켓)
-- ──────────────────────────────────────────────
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  local_id text not null,
  movie_nm text not null,
  watch_date date,
  theater text,
  seat text,
  companions text,
  snacks text,
  review text,
  serial text,
  poster text,
  created_at timestamptz default now(),
  unique(user_id, local_id)
);

alter table public.tickets enable row level security;

create policy "tickets_all_own" on public.tickets
  for all using (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 5. BUCKETS (버킷리스트 보드)
-- ──────────────────────────────────────────────
create table if not exists public.buckets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  local_id text not null,
  title text not null,
  items jsonb default '[]',
  created_at timestamptz default now(),
  unique(user_id, local_id)
);

alter table public.buckets enable row level security;

create policy "buckets_all_own" on public.buckets
  for all using (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 6. COACH USAGE (AI 코칭 일일 횟수 - 서버사이드)
-- ──────────────────────────────────────────────
create table if not exists public.coach_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  usage_date date not null default current_date,
  count integer default 0 check (count >= 0),
  unique(user_id, usage_date)
);

alter table public.coach_usage enable row level security;

create policy "coach_usage_select_own" on public.coach_usage
  for select using (auth.uid() = user_id);
-- INSERT/UPDATE is handled by server-side service_role only
