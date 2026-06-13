"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

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
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(10);
  const [presetIdx, setPresetIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [dlReady, setDlReady] = useState<string | null>(null);

  async function downloadVideo(quality: "720" | "1080") {
    if (!videoId) return;
    setDlBusy(quality);
    setDlError(null);
    setDlReady(null);
    try {
      const res = await fetch("/api/clips/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, quality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Download failed");
      // The relay streams the file with an attachment header, so opening the
      // link downloads it directly (the heavy work never touches our server).
      const a = document.createElement("a");
      a.href = data.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDlReady(quality);
    } catch (e) {
      setDlError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlBusy(null);
    }
  }

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

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Clip Finder</h1>
      <p className="mt-1 text-sm text-white/50">
        Paste a YouTube link. The AI watches the video and finds the most powerful moments to cut into
        shorts — with timestamps, a hook reason, a caption, and the transcript for each.
      </p>

      <form onSubmit={analyze} className="card mt-6 space-y-4">
        <div>
          <label className="label">YouTube link</label>
          <input
            className="input w-full"
            type="text"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label">Clips to find</label>
            <input
              className="input w-24"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Clip length</label>
            <select
              className="input"
              value={presetIdx}
              onChange={(e) => setPresetIdx(Number(e.target.value))}
            >
              {LENGTH_PRESETS.map((p, i) => (
                <option key={i} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={busy || url.trim().length < 8} className="btn-gold">
          {busy ? "Watching the video…" : "Find clips"}
        </button>
        {busy && (
          <p className="text-xs text-white/40">
            Analyzing the full video can take 20–60 seconds depending on its length.
          </p>
        )}
      </form>

      {error && (
        <div className="card mt-6 border-red-900 bg-red-950/40">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {videoId && (
        <div className="card mt-6">
          <h2 className="font-semibold">Download the source video</h2>
          <p className="mt-1 text-sm text-white/50">
            Grab the full video, then cut it in CapCut using the timestamps below. 1080p takes a bit
            longer (audio + video are merged for you).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => downloadVideo("720")}
              disabled={dlBusy !== null}
              className="btn-ghost"
            >
              {dlBusy === "720" ? "Preparing 720p…" : "⬇ Download 720p"}
            </button>
            <button
              onClick={() => downloadVideo("1080")}
              disabled={dlBusy !== null}
              className="btn-gold"
            >
              {dlBusy === "1080" ? "Preparing 1080p…" : "⬇ Download 1080p"}
            </button>
          </div>
          {dlBusy && (
            <p className="mt-3 text-xs text-white/40">
              Fetching and merging on a free relay — this can take 10–40 seconds. Your download opens
              in a new tab when ready.
            </p>
          )}
          {dlReady && (
            <p className="mt-3 text-sm text-gold">
              {dlReady}p download started in a new tab. If nothing happened, allow pop-ups for this
              site and try again.
            </p>
          )}
          {dlError && <p className="mt-3 text-sm text-red-400">{dlError}</p>}
        </div>
      )}

      {clips && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              {clips.length} clip{clips.length !== 1 ? "s" : ""} found
            </h2>
            <div className="flex gap-2">
              <button onClick={copyAll} className="btn-ghost px-3 py-1.5 text-xs">
                {copied === "all" ? "Copied!" : "Copy all"}
              </button>
              <button onClick={downloadTxt} className="btn-ghost px-3 py-1.5 text-xs">
                ⬇ Download .txt
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {clips.map((c, i) => {
              const len = c.end_seconds - c.start_seconds;
              const jump = `https://www.youtube.com/watch?v=${videoId}&t=${c.start_seconds}s`;
              return (
                <div key={i} className="card">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
                      {i + 1}
                    </span>
                    <code className="rounded bg-ink px-2 py-1 text-sm text-gold">
                      {c.start} → {c.end}
                    </code>
                    <span className="text-xs text-white/40">{len}s</span>
                    <button
                      onClick={() => copy(`${c.start} - ${c.end}`, `ts${i}`)}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      {copied === `ts${i}` ? "Copied!" : "Copy times"}
                    </button>
                    <a href={jump} target="_blank" rel="noreferrer" className="btn-ghost px-2 py-1 text-xs">
                      ▶ Preview on YouTube
                    </a>
                  </div>

                  <p className="mt-3 font-semibold text-white/90">{c.title}</p>
                  {c.reason && (
                    <p className="mt-1 text-sm text-gold/80">
                      <span className="text-white/40">Why it works: </span>
                      {c.reason}
                    </p>
                  )}
                  {c.transcript && (
                    <p className="mt-2 text-sm leading-relaxed text-white/60">“{c.transcript}”</p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-white/30">
            Download the video above, then cut to these timestamps in CapCut to make your shorts.
          </p>
        </div>
      )}
    </AppShell>
  );
}
