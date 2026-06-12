-- Adds per-project image orientation: '16:9' (YouTube) or '9:16' (TikTok).
-- Run this in the Supabase SQL editor.

alter table public.projects
  add column if not exists aspect_ratio text not null default '16:9';
