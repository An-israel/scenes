-- Story shorts: locked art style, a story "world" line, recurring characters
-- with reference sheets, and which characters appear in each shot.
-- Run this in the Supabase SQL editor after 0001–0004.

alter table public.projects
  add column if not exists style text not null default 'storybook',
  add column if not exists setting text;

alter table public.scenes
  add column if not exists characters text[] not null default '{}';

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  idx int not null,
  name text not null,
  look text not null,
  sheet_path text,                      -- storage path of the reference sheet image
  unique(project_id, idx)
);

create index if not exists characters_project_idx on public.characters(project_id, idx);

alter table public.characters enable row level security;

create policy "characters_select_own" on public.characters
  for select using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
create policy "characters_insert_own" on public.characters
  for insert with check (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
create policy "characters_update_own" on public.characters
  for update using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
create policy "characters_delete_own" on public.characters
  for delete using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
