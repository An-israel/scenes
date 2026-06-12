"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildProjectZip, triggerDownload, formatClock, type ZipProgress } from "@/lib/client/zip";
import type { Project, Scene, SceneAssetUrls } from "@/lib/types";

interface Props {
  initialProject: Project;
  initialScenes: Scene[];
}

type Phase = "idle" | "splitting" | "generating" | "finalizing" | "zipping" | "done" | "error";

const BACKOFF_MS = [2000, 4000, 8000];

async function callApi<T = any>(url: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: body !== undefined ? "POST" : "GET",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < BACKOFF_MS.length) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  }
}

export default function ProjectFactory({ initialProject, initialScenes }: Props) {
  const [project, setProject] = useState(initialProject);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [assets, setAssets] = useState<SceneAssetUrls[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLine, setStatusLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyScene, setBusyScene] = useState<string | null>(null);
  const runningRef = useRef(false);

  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;

  const refreshAssets = useCallback(async () => {
    try {
      const data = await callApi<{ assets: SceneAssetUrls[]; zip_url: string | null; project: Project }>(
        `/api/projects/${initialProject.id}/assets`
      );
      setAssets(data.assets);
      setZipUrl(data.zip_url);
      setProject(data.project);
      return data;
    } catch {
      return null;
    }
  }, [initialProject.id]);

  const updateScene = useCallback((id: string, patch: Partial<Scene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /** Generate missing audio + image for one scene (parallel within the scene). */
  const processScene = useCallback(
    async (scene: Scene, position: number, total: number) => {
      const jobs: Promise<void>[] = [];
      if (!scene.audio_path) {
        setStatusLine(`Scene ${position}/${total}: voicing…`);
        jobs.push(
          callApi("/api/tts", { sceneId: scene.id }).then((d: any) =>
            updateScene(scene.id, { audio_path: d.audio_path, duration_ms: d.duration_ms, status: d.status })
          )
        );
      }
      if (!scene.image_path) {
        setStatusLine(`Scene ${position}/${total}: ${scene.audio_path ? "drawing…" : "voicing + drawing…"}`);
        jobs.push(
          callApi("/api/image", { sceneId: scene.id }).then((d: any) =>
            updateScene(scene.id, { image_path: d.image_path, status: d.status })
          )
        );
      }
      await Promise.all(jobs);
    },
    [updateScene]
  );

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    try {
      // 1. Split (idempotent — returns existing scenes on resume).
      let currentScenes = scenesRef.current;
      if (currentScenes.length === 0) {
        setPhase("splitting");
        setStatusLine("Splitting script into scenes…");
        const data = await callApi<{ scenes: Scene[] }>("/api/split", { projectId: project.id });
        currentScenes = data.scenes;
        setScenes(currentScenes);
      }

      // 2. Per-scene generation, sequential across scenes (free-tier friendly).
      setPhase("generating");
      const total = currentScenes.length;
      for (let i = 0; i < total; i++) {
        const scene = scenesRef.current.find((s) => s.id === currentScenes[i].id)!;
        if (scene.audio_path && scene.image_path) continue;
        await processScene(scene, i + 1, total);
        refreshAssets(); // fire-and-forget thumbnail refresh
      }

      // 3. Finalize: exact timestamps from real durations.
      setPhase("finalizing");
      setStatusLine("Computing timestamps…");
      await callApi("/api/finalize", { projectId: project.id });
      await refreshAssets();
      setPhase("done");
      setStatusLine("");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      runningRef.current = false;
    }
  }, [project.id, processScene, refreshAssets]);

  // Auto-start fresh projects; otherwise load thumbnails for whatever exists.
  useEffect(() => {
    refreshAssets().then(() => {
      if (initialProject.status === "draft" || initialProject.status === "splitting") {
        run();
      } else if (initialProject.status === "done") {
        setPhase("done");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const incomplete = scenes.filter((s) => !s.audio_path || !s.image_path).length;
  const completed = scenes.length - incomplete;
  const isRunning = phase === "splitting" || phase === "generating" || phase === "finalizing";
  const canResume =
    !isRunning && phase !== "zipping" && (scenes.length === 0 || incomplete > 0);

  async function regenerate(scene: Scene, kind: "audio" | "image") {
    setBusyScene(scene.id + kind);
    setError(null);
    try {
      const d: any = await callApi(kind === "audio" ? "/api/tts" : "/api/image", { sceneId: scene.id });
      updateScene(
        scene.id,
        kind === "audio"
          ? { audio_path: d.audio_path, duration_ms: d.duration_ms, status: d.status }
          : { image_path: d.image_path, status: d.status }
      );
      // Re-finalize so timestamps stay exact after an audio regen.
      await callApi("/api/finalize", { projectId: project.id }).catch(() => {});
      await refreshAssets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setBusyScene(null);
    }
  }

  async function downloadZip() {
    setPhase("zipping");
    setError(null);
    try {
      const data = await refreshAssets();
      if (!data) throw new Error("Could not load assets");
      const blob = await buildProjectZip(data.assets, (p: ZipProgress) =>
        setStatusLine(p.total ? `${p.step} ${p.current}/${p.total}…` : `${p.step}…`)
      );
      triggerDownload(blob, `${project.title.replace(/[^\w-]+/g, "_") || "sceneforge"}.zip`);

      // Upload for later re-download (direct to Storage — RLS scopes the path).
      setStatusLine("Saving ZIP to your library…");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const zipPath = `${user.id}/${project.id}/final.zip`;
        const { error: upErr } = await supabase.storage
          .from("assets")
          .upload(zipPath, blob, { contentType: "application/zip", upsert: true });
        if (!upErr) {
          await callApi(`/api/projects/${project.id}/zip-path`, { zipPath });
          await refreshAssets();
        }
      }
      setPhase("done");
      setStatusLine("");
    } catch (e) {
      setPhase("done");
      setError(e instanceof Error ? e.message : "ZIP build failed");
    }
  }

  const assetByScene = new Map(assets.map((a) => [a.id, a]));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="mt-1 text-sm text-white/40">
            Voice: {project.voice_id}
            {project.total_duration_ms ? ` · ${formatClock(project.total_duration_ms)} total` : ""}
            {scenes.length > 0 ? ` · ${scenes.length} scenes` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          {canResume && (
            <button onClick={run} className="btn-ghost">
              {scenes.length === 0 ? "Start generation" : `Resume (${incomplete} left)`}
            </button>
          )}
          {project.status === "done" && incomplete === 0 && (
            <button onClick={downloadZip} disabled={phase === "zipping"} className="btn-gold">
              {phase === "zipping" ? "Building…" : "⬇ Download ZIP"}
            </button>
          )}
          {zipUrl && phase !== "zipping" && (
            <a href={zipUrl} className="btn-ghost" download>
              Re-download last ZIP
            </a>
          )}
        </div>
      </div>

      {(isRunning || phase === "zipping") && (
        <div className="card mb-6">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
            <p className="text-sm">{statusLine || "Working…"}</p>
          </div>
          {scenes.length > 0 && phase === "generating" && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-edge">
              <div
                className="h-full bg-gold transition-all"
                style={{ width: `${(completed / scenes.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="card mb-6 border-red-900 bg-red-950/40">
          <p className="text-sm text-red-300">{error}</p>
          {canResume && (
            <button onClick={run} className="btn-ghost mt-3 text-xs">
              Try resume
            </button>
          )}
        </div>
      )}

      {/* Timeline strip when done */}
      {project.status === "done" && assets.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-1 pb-2">
            {assets.map((a) => (
              <div key={a.id} className="shrink-0">
                {a.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.image_url}
                    alt={`Scene ${a.idx}`}
                    className="h-16 rounded border border-edge"
                  />
                ) : (
                  <div className="h-16 w-28 rounded border border-edge bg-panel" />
                )}
                <p className="mt-1 text-center text-[10px] text-white/40">
                  {a.start_ms != null ? formatClock(a.start_ms) : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scene grid */}
      {scenes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((s) => {
            const a = assetByScene.get(s.id);
            return (
              <div key={s.id} className="card p-0 overflow-hidden">
                <div className="aspect-video bg-ink">
                  {a?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image_url} alt={`Scene ${s.idx}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/20">
                      {s.image_path ? "…" : isRunning ? "waiting to draw…" : "no image yet"}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span className="font-semibold text-gold">#{s.idx}</span>
                    <span>
                      {s.start_ms != null && `${formatClock(s.start_ms)} · `}
                      {s.duration_ms != null ? `${(s.duration_ms / 1000).toFixed(1)}s` : "no audio yet"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-white/70">{s.text}</p>
                  {a?.audio_url && (
                    <audio src={a.audio_url} controls preload="none" className="mt-3 h-8 w-full" />
                  )}
                  {!isRunning && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => regenerate(s, "audio")}
                        disabled={busyScene !== null}
                        className="btn-ghost flex-1 px-2 py-1.5 text-xs"
                      >
                        {busyScene === s.id + "audio" ? "Voicing…" : "↻ Audio"}
                      </button>
                      <button
                        onClick={() => regenerate(s, "image")}
                        disabled={busyScene !== null}
                        className="btn-ghost flex-1 px-2 py-1.5 text-xs"
                      >
                        {busyScene === s.id + "image" ? "Drawing…" : "↻ Image"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !isRunning && (
          <div className="card py-12 text-center text-white/40">
            Script saved. Hit <span className="text-gold">Start generation</span> to forge your scenes.
          </div>
        )
      )}
    </div>
  );
}
