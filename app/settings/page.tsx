"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

export default function SettingsPage() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/key/save")
      .then((r) => r.json())
      .then((d) => setHasKey(!!d.hasKey))
      .catch(() => setHasKey(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/key/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save key");
      setHasKey(true);
      setApiKey("");
      setMessage(`Key validated and saved (${data.masked}). You're ready to forge.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-8 text-2xl font-bold">Settings</h1>

      <div className="card max-w-xl">
        <h2 className="font-semibold">Gemini API key</h2>
        <p className="mt-1 text-sm text-white/50">
          SceneForge runs entirely on your own free Google AI Studio key. It's stored encrypted
          and only used server-side for your projects.
        </p>

        {hasKey === null ? (
          <p className="mt-4 text-sm text-white/40">Checking…</p>
        ) : hasKey ? (
          <p className="mt-4 text-sm text-gold">✓ A key is on file. Paste a new one below to replace it.</p>
        ) : (
          <p className="mt-4 text-sm text-red-400">No key yet — generation won't work until you add one.</p>
        )}

        <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="input flex-1"
            type="password"
            placeholder="AIza…"
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

      <div className="card mt-6 max-w-xl">
        <h2 className="font-semibold">How to get a free key</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/60">
          <li>
            Go to{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-gold underline"
            >
              aistudio.google.com/apikey
            </a>{" "}
            and sign in with any Google account.
          </li>
          <li>Click “Create API key” and copy it.</li>
          <li>Paste it above and hit Save. Done — the free tier covers regular use.</li>
        </ol>
      </div>
    </AppShell>
  );
}
