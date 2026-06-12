-- SceneForge initial schema. Run this in the Supabase SQL editor.

-- ============ TABLES ============

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  gemini_api_key_encrypted text,        -- AES-256-GCM, never sent to client
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null default 'Untitled',
  script text not null,
  voice_id text not null,               -- e.g. 'Charon'
  status text not null default 'draft', -- draft|splitting|generating|done|error
  total_duration_ms int,
  zip_path text,                        -- Supabase Storage path of final ZIP
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  idx int not null,                     -- 1-based scene order
  text text not null,
  image_description text not null,
  audio_path text,                      -- storage path of scene WAV
  image_path text,                      -- storage path of scene PNG
  duration_ms int,                      -- real duration from generated audio
  start_ms int,                         -- computed cumulative start
  status text not null default 'pending', -- pending|audio_done|image_done|done|error
  unique(project_id, idx)
);

create index if not exists scenes_project_idx on public.scenes(project_id, idx);
create index if not exists projects_user_idx on public.projects(user_id, created_at desc);

-- ============ PROFILE AUTO-CREATION TRIGGER ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ ROW LEVEL SECURITY ============

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.scenes enable row level security;

-- profiles: owner can read/update own row (key column is only written server-side
-- with the service role, but owner read is fine — clients never receive the
-- encrypted column because API selects exclude it).
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- projects: full CRUD on own rows
create policy "projects_select_own" on public.projects
  for select using (user_id = auth.uid());
create policy "projects_insert_own" on public.projects
  for insert with check (user_id = auth.uid());
create policy "projects_update_own" on public.projects
  for update using (user_id = auth.uid());
create policy "projects_delete_own" on public.projects
  for delete using (user_id = auth.uid());

-- scenes: via owning project
create policy "scenes_select_own" on public.scenes
  for select using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
create policy "scenes_insert_own" on public.scenes
  for insert with check (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
create policy "scenes_update_own" on public.scenes
  for update using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
create policy "scenes_delete_own" on public.scenes
  for delete using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- ============ STORAGE ============

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Paths are {userId}/{projectId}/... — first folder must match the user.
create policy "assets_select_own" on storage.objects
  for select using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets_insert_own" on storage.objects
  for insert with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets_update_own" on storage.objects
  for update using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets_delete_own" on storage.objects
  for delete using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
