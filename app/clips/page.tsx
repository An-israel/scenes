"use client";

import { useState } from "react";
import AppShell, { PageHead } from "@/components/AppShell";
import AccessPending from "@/components/AccessPending";
import { useMember } from "@/components/useMember";
import { Arrow } from "@/components/ui";

interface Clip {
  start: string;
  end: string;
  start_seconds: number;
  end_seconds: number;
  title: string;
  reason: string;
  transcript: string;
}

const LENGTH_PRESETS = [
  { label: "Shorts (15–60s)", minSec: 15, maxSec: 60 },
  { label: "Punchy (30–90s)", minSec: 30, maxSec: 90 },
  { label: "Up to 2 min (45–120s)", minSec: 45, maxSec: 120 },
];

export default function ClipsPage() {
  const me = useMember();
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(10);
  const [presetIdx, setPresetIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setClips(null);
    const preset = LENGTH_PRESETS[presetIdx];
    try {
      const res = await fetch("/api/clips/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, count, minSec: preset.minSec, maxSec: preset.maxSec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setClips(data.clips);
      setVideoId(data.videoId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  function copyAll() {
    if (!clips) return;
    const lines = clips.map(
      (c, i) =>
        `CLIP ${i + 1}  [${c.start} → ${c.end}]\n` +
        `Title: ${c.title}\n` +
        `Why: ${c.reason}\n` +
        `Transcript: ${c.transcript}\n`
    );
    copy(
      `Clip recipes for https://www.youtube.com/watch?v=${videoId}\n\n${lines.join("\n")}`,
      "all"
    );
  }

  function downloadTxt() {
    if (!clips) return;
    const lines = clips.map(
      (c, i) =>
        `CLIP ${i + 1}  [${c.start} -> ${c.end}]  (${c.end_seconds - c.start_seconds}s)\n` +
        `Title: ${c.title}\n` +
        `Why it works: ${c.reason}\n` +
        `Transcript: ${c.transcript}\n`
    );
    const body = `CLIP RECIPES\nSource: https://www.youtube.com/watch?v=${videoId}\n\n${lines.join("\n")}`;
    const blob = new Blob([body], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clips_${videoId}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  if (me && !me.allowed) {
    return (
      <AppShell>
        <PageHead eyebrow="Clip finder" title="Find the moments." />
        <AccessPending email={me.email} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHead eyebrow="Clip finder" title="Find the moments." />
      <p className="lede -mt-4 mb-12 max-w-2xl">
        Paste a public YouTube link. The video is watched end to end and the strongest moments come back as
        ready-to-cut clips — timestamps, a caption, why it works, and the transcript.
      </p>

      <form onSubmit={analyze} className="rounded-xl border border-line bg-card p-6 sm:p-8">
        <label className="field-label" htmlFor="yt">
          YouTube link
        </label>
        <input
          id="yt"
          className="input"
          type="text"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="mt-6 flex flex-wrap items-end gap-6">
          <div>
            <label className="field-label" htmlFor="count">
              Clips
            </label>
            <input
              id="count"
              className="input w-24"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="len">
              Length
            </label>
            <select id="len" className="input" value={presetIdx} onChange={(e) => setPresetIdx(Number(e.target.value))}>
              {LENGTH_PRESETS.map((p, i) => (
                <option key={i} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={busy || url.trim().length < 8} className="btn-primary">
            {busy ? "Watching the video…" : "Find clips"}
          </button>
        </div>
        {busy && <p className="mt-4 font-mono text-xs text-forest-mute">Longer videos can take up to a minute.</p>}
      </form>

      {error && (
        <div className="mt-8 rounded-xl border border-clay/40 bg-clay-tint p-6">
          <p className="text-clay-dark">{error}</p>
        </div>
      )}

      {clips && (
        <section className="mt-16">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <p className="label">
              {String(clips.length).padStart(2, "0")} clip{clips.length !== 1 ? "s" : ""} found
            </p>
            <div className="flex gap-2">
              <button onClick={copyAll} className="btn-quiet">
                {copied === "all" ? "Copied" : "Copy all"}
              </button>
              <button onClick={downloadTxt} className="btn-quiet">
                Save as .txt
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-card">
            {clips.map((c, i) => {
              const len = c.end_seconds - c.start_seconds;
              const jump = `https://www.youtube.com/watch?v=${videoId}&t=${c.start_seconds}s`;
              return (
                <div key={i} className={`grid gap-4 p-6 sm:grid-cols-[3rem_1fr] sm:p-8 ${i > 0 ? "border-t border-line" : ""}`}>
                  <span className="font-mono text-sm text-clay">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded bg-ochre-tint px-2.5 py-1 font-mono text-sm">
                        {c.start} – {c.end}
                      </span>
                      <span className="font-mono text-xs text-forest-mute">{len}s</span>
                      <button onClick={() => copy(`${c.start} - ${c.end}`, `ts${i}`)} className="btn-quiet">
                        {copied === `ts${i}` ? "Copied" : "Copy times"}
                      </button>
                      <a href={jump} target="_blank" rel="noreferrer" className="link-arrow text-sm">
                        Open at this moment <Arrow />
                      </a>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight">{c.title}</h3>
                    {c.reason && <p className="mt-2 text-forest-soft">{c.reason}</p>}
                    {c.transcript && (
                      <p className="mt-4 border-l-2 border-line pl-4 leading-relaxed text-forest-soft">{c.transcript}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AppShell>
  );
}
