"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, { PageHead } from "@/components/AppShell";
import AccessPending from "@/components/AccessPending";
import { useMember } from "@/components/useMember";
import { VOICES } from "@/lib/voices";
import { ART_STYLES } from "@/lib/styles";
import { MAX_STORY_WORDS, countWords, estimateSeconds } from "@/lib/story";

export default function NewStoryPage() {
  const router = useRouter();
  const me = useMember();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [style, setStyle] = useState(ART_STYLES[0].id);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const words = useMemo(() => countWords(script), [script]);
  const seconds = estimateSeconds(words);
  const tooLong = words > MAX_STORY_WORDS;

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

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, script, voiceId, aspectRatio, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the project");
      router.push(`/project/${data.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the project");
      setBusy(false);
    }
  }

  if (me && !me.allowed) {
    return (
      <AppShell>
        <PageHead eyebrow="New story" title="Write a story." />
        <AccessPending email={me.email} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHead eyebrow="New story" title="Write a story." />

      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <label className="field-label" htmlFor="title">
            Title <span className="normal-case tracking-normal text-forest-mute">— optional</span>
          </label>
          <input
            id="title"
            className="input mb-8"
            placeholder="Leave blank and we'll title it for you"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className="field-label" htmlFor="script">
            Story
          </label>
          <textarea
            id="script"
            className="input min-h-[340px] resize-y text-[17px] leading-relaxed"
            placeholder="Mara found the lighthouse key in her grandfather's coat. That night, the lamp turned on by itself…"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between font-mono text-xs">
            <span className="text-forest-mute">{words} words</span>
            <span className={tooLong ? "text-clay-dark" : "text-forest-soft"}>
              ≈ {seconds}s {tooLong ? `— keep it under ${MAX_STORY_WORDS} words` : words > 0 ? "of narration" : ""}
            </span>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full transition-all ${tooLong ? "bg-clay" : "bg-forest"}`}
              style={{ width: `${Math.min(100, (seconds / 60) * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-forest-mute">
            Aim for 75–150 words. Name your characters and they&apos;ll look the same in every shot.
          </p>
        </div>

        <div className="space-y-10">
          <fieldset>
            <legend className="field-label">Format</legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["9:16", "Vertical", "Shorts, Reels, TikTok"],
                  ["16:9", "Landscape", "YouTube"],
                ] as const
              ).map(([ratio, name, hint]) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`choice ${aspectRatio === ratio ? "choice-on" : ""}`}
                >
                  <span className="block font-semibold">{name}</span>
                  <span className="mt-1 block text-sm text-forest-mute">
                    {ratio} · {hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="field-label">Art style</legend>
            <div className="grid grid-cols-2 gap-3">
              {ART_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`choice ${style === s.id ? "choice-on" : ""}`}
                >
                  <span className="block font-semibold">{s.label}</span>
                  <span className="mt-1 block text-sm text-forest-mute">{s.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="field-label">Narrator</legend>
            <div className="overflow-hidden rounded-md border border-line bg-card">
              {VOICES.map((v, i) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-line" : ""} ${
                    voiceId === v.id ? "bg-forest-tint" : ""
                  }`}
                >
                  <button type="button" className="flex-1 text-left" onClick={() => setVoiceId(v.id)}>
                    <span className="font-semibold">{v.label}</span>
                    <span className="ml-3 text-sm text-forest-mute">{v.hint}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => previewVoice(v.id)}
                    disabled={previewing !== null}
                    className="font-mono text-[11px] uppercase tracking-[0.14em] text-forest-soft hover:text-clay disabled:opacity-40"
                  >
                    {previewing === v.id ? "Loading" : "Listen"}
                  </button>
                </div>
              ))}
            </div>
          </fieldset>

          <div>
            <button onClick={create} disabled={busy || words < 10 || tooLong} className="btn-primary w-full">
              {busy ? "Creating…" : "Create the short"}
            </button>
            {error && <p className="mt-4 text-sm text-clay-dark">{error}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
