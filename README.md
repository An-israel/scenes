# Scenes

Write a short story → get a 30–60 second narrated short with the **same characters in every shot**.
Next.js 14 (App Router) + Supabase + Claude + Gemini, deployable on Vercel.

## How it works

1. **Storyboard** — Claude (or Gemini, if no Claude key) splits the story into 3–5 second shots, each with
   its line of narration and a drawable frame, and lists the recurring characters with a fixed visual
   description.
2. **Cast** — Gemini draws one reference sheet per character.
3. **Shots** — every shot is drawn with the reference sheets of the characters in it attached, so they stay
   consistent. Each shot's line is voiced separately with Gemini TTS, silence trimmed, so every image
   timestamp is exact.
4. **Export** — in the browser: one `audio.mp3`, `images/001_00m00s.png`… named by start time,
   `characters/`, `timeline.csv`, `readme.txt`, zipped. There's also an in-browser preview player.

The owner's API keys live on the server, and any signed-in account can generate. Access rules (plans,
approvals) belong in `requireMember()` in `lib/api-helpers.ts`, the single gate every paid call goes through.

## Setup

### 1. Supabase

1. **SQL Editor** → run every file in `supabase/migrations/` in order (`0001` … `0005`).
2. **Authentication → Providers**: enable Email and (optionally) Google.
3. **Authentication → URL Configuration**: set the Site URL to your domain and allow
   `https://<your-domain>/auth/callback` (plus `http://localhost:3000/auth/callback` for dev).

### 2. Environment variables

Copy `.env.example` → `.env.local` (and add the same values in Vercel → Settings → Environment Variables):

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `GEMINI_API_KEY` | Images, narration, Clip Finder (a paid-tier key is recommended) |
| `ANTHROPIC_API_KEY` | Storyboard writing (optional; Gemini is the fallback) |

### 3. Run

```bash
npm install
npm run dev
```

## Notes

- Stories are capped at 170 words (~70 s). 75–150 words gives a 30–60 s short.
- Model names drift; override with the `*_MODEL` env vars in `.env.example` without code changes.
- Clip Finder analyzes a public YouTube video and returns timestamped clip suggestions.
