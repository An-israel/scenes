"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { VOICES, OPENAI_VOICES } from "@/lib/voices";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [useOpenAI, setUseOpenAI] = useState<boolean | null>(null);

  // Voice list follows the engine that will actually narrate (OpenAI if its key is saved).
  useEffect(() => {
    fetch("/api/key/save")
      .then((r) => r.json())
      .then((d) => {
        const openai = !!d.openai;
        setUseOpenAI(openai);
        setVoiceId(openai ? OPENAI_VOICES[0].id : VOICES[0].id);
      })
      .catch(() => setUseOpenAI(false));
  }, []);

  const voiceList = useOpenAI ? OPENAI_VOICES : VOICES;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const wordCount = useMemo(
    () => (script.trim() ? script.trim().split(/\s+/).length : 0),
    [script]
  );
  const estMinutes = wordCount / 140;

  async function previewVoice(id: string) {
    setPreviewing(id);
    setError(null);
    try {
      const res = await fetch("/api/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      audioRef.current?.pause();
      const audio = new Audio(data.url);
      audioRef.current = audio;
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(null);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, script, voiceId, aspectRatio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create project");
      router.push(`/project/${data.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create project");
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-8 text-2xl font-bold">New project</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className="input mb-6"
            placeholder="e.g. Why Cavemen Slept Better Than You"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="label" htmlFor="script">
            Script
          </label>
          <textarea
            id="script"
            className="input min-h-[320px] resize-y font-mono text-sm leading-relaxed"
            placeholder="Paste your full narration script here…"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <div className="mt-2 flex justify-between text-sm text-white/40">
            <span>{wordCount} words</span>
            <span className={wordCount > 1400 ? "text-red-400" : ""}>
              ≈ {estMinutes.toFixed(1)} min {wordCount > 1400 && "— over the ~10 min sweet spot"}
            </span>
          </div>
        </div>

        <div>
          <p className="label">Format</p>
          <div className="mb-6 grid grid-cols-2 gap-2">
            {(
              [
                ["16:9", "YouTube", "Landscape"],
                ["9:16", "TikTok / Shorts", "Vertical"],
              ] as const
            ).map(([ratio, name, hint]) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  aspectRatio === ratio ? "border-gold bg-panel" : "border-edge hover:border-white/30"
                }`}
              >
                <span className="block text-sm font-medium">{name}</span>
                <span className="mt-0.5 block text-xs text-white/40">
                  {hint} · {ratio}
                </span>
              </button>
            ))}
          </div>

          <p className="label">
            Voice{useOpenAI != null && (
              <span className="ml-2 text-xs text-white/30">
                {useOpenAI ? "OpenAI voices" : "Gemini voices"}
              </span>
            )}
          </p>
          <div className="space-y-2">
            {voiceList.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 transition ${
                  voiceId === v.id ? "border-gold bg-panel" : "border-edge hover:border-white/30"
                }`}
              >
                <button className="flex-1 text-left text-sm" onClick={() => setVoiceId(v.id)}>
                  {v.label}
                </button>
                <button
                  onClick={() => previewVoice(v.id)}
                  disabled={previewing !== null}
                  className="ml-3 text-xs text-white/50 hover:text-gold disabled:opacity-40"
                  title="Preview voice"
                >
                  {previewing === v.id ? "…" : "▶ play"}
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={busy || wordCount < 5}
            className="btn-gold mt-6 w-full py-4 text-base"
          >
            {busy ? "Creating…" : "Generate →"}
          </button>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </AppShell>
  );
}
