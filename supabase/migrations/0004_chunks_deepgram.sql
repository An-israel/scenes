-- Fast-cut beats + chunked audio + Deepgram TTS support.
-- Run this in the Supabase SQL editor.

-- Scenes ("beats") that share one generated audio file carry the same chunk index.
alter table public.scenes
  add column if not exists chunk_idx int;

-- Per-user Deepgram API key (BYOK, encrypted like the others).
alter table public.profiles
  add column if not exists deepgram_api_key_encrypted text;
