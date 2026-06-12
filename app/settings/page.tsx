"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface KeyStatus {
  gemini: boolean;
  openai: boolean;
  deepgram: boolean;
}

function KeyCard({
  title,
  description,
  provider,
  hasKey,
  placeholder,
  onSaved,
}: {
  title: string;
  description: React.ReactNode;
  provider: "gemini" | "openai" | "deepgram";
  hasKey: boolean | null;
  placeholder: string;
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/key/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to remove key");
      setMessage("Key removed.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove key");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/key/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save key");
      setApiKey("");
      setMessage(`Key validated and saved (${data.masked}).`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-white/50">{description}</p>

      {hasKey === null ? (
        <p className="mt-4 text-sm text-white/40">Checking…</p>
      ) : hasKey ? (
        <p className="mt-4 text-sm text-gold">
          ✓ A key is on file. Paste a new one below to replace it, or{" "}
          <button type="button" onClick={remove} disabled={busy} className="underline text-red-400">
            remove it
          </button>
          .
        </p>
      ) : (
        <p className="mt-4 text-sm text-white/40">No key saved yet.</p>
      )}

      <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1"
          type="password"
          placeholder={placeholder}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || apiKey.trim().length < 20} className="btn-gold">
          {busy ? "Validating…" : "Save key"}
        </button>
      </form>

      {message && <p className="mt-3 text-sm text-gold">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [status, setStatus] = useState<KeyStatus | null>(null);

  function refresh() {
    fetch("/api/key/save")
      .then((r) => r.json())
      .then((d) => setStatus({ gemini: !!d.gemini, openai: !!d.openai, deepgram: !!d.deepgram }))
      .catch(() => setStatus({ gemini: false, openai: false, deepgram: false }));
  }
  useEffect(refresh, []);

  return (
    <AppShell>
      <h1 className="mb-8 text-2xl font-bold">Settings</h1>

      <div className="space-y-6">
        <KeyCard
          title="Deepgram API key — voices (free $200 credit)"
          provider="deepgram"
          hasKey={status ? status.deepgram : null}
          placeholder="Deepgram key…"
          onSaved={refresh}
          description={
            <>
              The recommended voice engine: new accounts get <span className="text-white/70">$200 of
              free credit with no card</span> — enough for 100+ hours of narration. Sign up at{" "}
              <a
                href="https://console.deepgram.com/signup"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline"
              >
                console.deepgram.com
              </a>
              , then create a key under <span className="text-white/70">API Keys</span> and paste it
              here.
            </>
          }
        />

        <KeyCard
          title="OpenAI API key — premium voices & images (optional)"
          provider="openai"
          hasKey={status ? status.openai : null}
          placeholder="sk-…"
          onSaved={refresh}
          description={
            <>
              Powers narration (gpt-4o-mini-tts) and scene images (gpt-image-1). Requires a paid
              OpenAI account with billing enabled — create a key at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline"
              >
                platform.openai.com/api-keys
              </a>
              . A typical 10-minute video costs roughly $1–2.
            </>
          }
        />

        <KeyCard
          title="Google Gemini key — script splitting (free)"
          provider="gemini"
          hasKey={status ? status.gemini : null}
          placeholder="AIza…"
          onSaved={refresh}
          description={
            <>
              Used to storyboard your script into scenes — free tier covers this. Get one at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline"
              >
                aistudio.google.com/apikey
              </a>
              . Optional if you have an OpenAI key (splitting falls back to OpenAI). Note: Google's
              free tier does <span className="text-white/70">not</span> include image generation via
              the API — that's why OpenAI handles images when its key is present.
            </>
          }
        />

        <div className="card max-w-xl">
          <h2 className="font-semibold">How the engines are chosen</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
            <li>Script splitting &amp; scene art: Gemini (free).</li>
            <li>Voices: OpenAI if saved, then Deepgram, then Gemini (free, limited per day).</li>
            <li>Audio is generated in long chunks (~20s each), so few calls cover a whole video.</li>
            <li>Keys are stored encrypted and only ever used server-side for your projects.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
