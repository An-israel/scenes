# SceneForge

Script in → voiced audio + timestamped 2D scene images out, in one ZIP. Built with Next.js 14
(App Router) + Supabase + Google Gemini (BYOK), deployable on Vercel for $0.

## How it works

1. Paste a script (≤ ~1,400 words ≈ 10 min) and pick a Gemini TTS voice.
2. `gemini-2.5-flash` splits the script into visual scenes (locked storyboard prompt).
3. Per scene: Gemini TTS renders a WAV (exact duration read from the PCM) and
   `gemini-2.5-flash-image` draws one 16:9 frame in a locked stick-figure cartoon style.
4. The **browser** orchestrates everything scene-by-scene (Vercel functions stay tiny), with
   progress UI, 429 backoff, and resume after interruption.
5. Client-side: WAVs are concatenated → MP3 (lamejs), images named `001_00m00s.png` by real
   start timestamp, plus `timeline.csv` + `readme.txt` → one ZIP, downloaded and saved to
   Supabase Storage for re-download.

Every user brings their own free [AI Studio](https://aistudio.google.com/apikey) key, stored
AES-256-GCM encrypted and only ever used server-side.

## One-time setup

### 1. Supabase

1. Open your Supabase project → **SQL Editor** → run `supabase/migrations/0001_init.sql`
   (tables, RLS, profile trigger, private `assets` bucket + storage policies).
2. **Authentication → Providers**: enable **Email**, and enable **Google**
   (create OAuth credentials in Google Cloud Console; authorized redirect URI is
   `https://<your-project-ref>.supabase.co/auth/v1/callback`).
3. **Authentication → URL Configuration**: set Site URL to your Vercel domain and add
   `https://<your-domain>/auth/callback` (plus `http://localhost:3000/auth/callback` for dev)
   to the redirect allow-list.

### 2. Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Var | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret) |
| `APP_ENCRYPTION_SECRET` | `openssl rand -hex 32` |

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

1. Import the GitHub repo into Vercel (framework auto-detected: Next.js).
2. Add the four env vars above in Project → Settings → Environment Variables.
3. Deploy, then update Supabase's Site URL / redirect URLs to the production domain.

### 5. First run

Sign in → **Settings** → paste your free Gemini key → **New project** → paste script, pick a
voice, Generate → watch the factory → **Download ZIP** → assemble in CapCut.

## Notes & limits

- **Free-tier image quota is the bottleneck** (~50–70 images for a 10-min video). 429s are
  retried with backoff and runs are resumable, so an interrupted day can be finished later.
- Model names drift; override with `GEMINI_TEXT_MODEL`, `GEMINI_TTS_MODEL`,
  `GEMINI_IMAGE_MODEL` env vars without code changes.
- Timestamps always come from real audio durations — never estimates.
