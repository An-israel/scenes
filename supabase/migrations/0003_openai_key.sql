-- Adds storage for a per-user OpenAI API key (BYOK, encrypted like the Gemini key).
-- Run this in the Supabase SQL editor.

alter table public.profiles
  add column if not exists openai_api_key_encrypted text;
