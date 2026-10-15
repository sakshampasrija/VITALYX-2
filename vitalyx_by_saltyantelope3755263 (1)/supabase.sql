-- Run once in the Supabase SQL Editor to create the VITALYX account-data table.
-- Existing tables are not modified.
create table if not exists public.vitalyx_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  app_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vitalyx_profiles enable row level security;

drop policy if exists "vitalyx_profiles_select_own" on public.vitalyx_profiles;
create policy "vitalyx_profiles_select_own"
  on public.vitalyx_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "vitalyx_profiles_insert_own" on public.vitalyx_profiles;
create policy "vitalyx_profiles_insert_own"
  on public.vitalyx_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "vitalyx_profiles_update_own" on public.vitalyx_profiles;
create policy "vitalyx_profiles_update_own"
  on public.vitalyx_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.vitalyx_profiles to authenticated;
