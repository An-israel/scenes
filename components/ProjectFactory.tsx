"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildProjectZip, triggerDownload, formatClock, svgToPng, type ZipProgress } from "@/lib/client/zip";
import { buildProjectVideo, canExportVideo, type VideoProgress } from "@/lib/client/video";
import { extOfUrl, mimeForExt } from "@/lib/media";
import { getStyle } from "@/lib/styles";
import { getVoice } from "@/lib/voices";
import type { CharacterAsset, Project, Scene, SceneAssetUrls } from "@/lib/types";

interface Props {
  initialProject: Project;
  initialScenes: Scene[];
}

type Phase = "idle" | "storyboard" | "cast" | "shots" | "finalizing" | "zipping" | "rendering" | "done" | "error";

interface AssetsResponse {
  assets: SceneAssetUrls[];
  characters: CharacterAsset[];
  zip_url: string | null;
  project: Project;
}

const BACKOFF_MS = [3000, 6000, 12000];
// Signed URLs last an hour; refresh well before that while the page is open.
const REFRESH_EVERY_MS = 40 * 60 * 1000;

async function callApi<T = any>(url: string, body?: unknown, method?: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: method ?? (body !== undefined ? "POST" : "GET"),
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

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  storyboard: "Writing the storyboard",
  cast: "Designing the characters",
  shots: "Drawing and voicing shots",
  finalizing: "Setting the timing",
  zipping: "Packing your download",
  rendering: "Rendering your video",
  done: "",
  error: "",
};

export default function ProjectFactory({ initialProject, initialScenes }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [assets, setAssets] = useState<SceneAssetUrls[]>([]);
  const [cast, setCast] = useState<CharacterAsset[]>([]);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLine, setStatusLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialProject.title);
  const [captions, setCaptions] = useState(true);
  const [videoSupported, setVideoSupported] = useState(true);
  const runningRef = useRef(false);
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;

  const refreshAssets = useCallback(async (): Promise<AssetsResponse | null> => {
    try {
      const data = await callApi<AssetsResponse>(`/api/projects/${initialProject.id}/assets`);
      setAssets(data.assets);
      setCast(data.characters);
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

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    setNotice(null);
    try {
      // 1. Storyboard (idempotent — returns the existing one on resume).
      let local = scenesRef.current;
      if (local.length === 0) {
        setPhase("storyboard");
        setStatusLine("Splitting your story into shots and finding the characters…");
        const data = await callApi<{ scenes: Scene[]; title?: string }>("/api/split", { projectId: project.id });
        local = data.scenes;
        setScenes(local);
        if (data.title) {
          setProject((p) => ({ ...p, title: data.title! }));
          setTitleDraft(data.title);
        }
      }

      // 2. Character sheets — every shot is drawn against these.
      let data = await refreshAssets();
      const missingSheets = (data?.characters ?? []).filter((c) => !c.sheet_url);
      if (missingSheets.length > 0) setPhase("cast");
      for (let i = 0; i < missingSheets.length; i++) {
        setStatusLine(`Character ${i + 1} of ${missingSheets.length}: ${missingSheets[i].name}`);
        await callApi("/api/character", { characterId: missingSheets[i].id });
        data = await refreshAssets();
      }

      // 3. Shots, one at a time: voice and image in parallel within a shot.
      setPhase("shots");
      const total = local.length;
      for (let i = 0; i < total; i++) {
        const shot = scenesRef.current.find((s) => s.id === local[i].id) ?? local[i];
        if (shot.audio_path && shot.image_path) continue;
        setStatusLine(`Shot ${i + 1} of ${total}`);
        const jobs: Promise<void>[] = [];
        if (!shot.audio_path) {
          jobs.push(
            callApi("/api/tts", { sceneId: shot.id }).then((d: any) =>
              updateScene(shot.id, { audio_path: d.audio_path, duration_ms: d.duration_ms, status: d.status })
            )
          );
        }
        if (!shot.image_path) {
          jobs.push(
            callApi("/api/image", { sceneId: shot.id }).then((d: any) =>
              updateScene(shot.id, { image_path: d.image_path, status: d.status })
            )
          );
        }
        await Promise.all(jobs);
        refreshAssets();
      }

      // 4. Timing from the real audio lengths.
      setPhase("finalizing");
      setStatusLine("Lining every image up with its words…");
      await callApi("/api/finalize", { projectId: project.id });
      await refreshAssets();
      router.refresh();
      setPhase("done");
      setStatusLine("");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Generation failed");
      refreshAssets();
    } finally {
      runningRef.current = false;
    }
  }, [project.id, refreshAssets, updateScene, router]);

  useEffect(() => {
    refreshAssets().then(() => {
      if (initialProject.status === "draft" || initialProject.status === "splitting") run();
      else if (initialProject.status === "done") setPhase("done");
    });
    setVideoSupported(canExportVideo());
    const timer = setInterval(refreshAssets, REFRESH_EVERY_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const incomplete = scenes.filter((s) => !s.audio_path || !s.image_path).length;
  const completed = scenes.length - incomplete;
  const isRunning = phase === "storyboard" || phase === "cast" || phase === "shots" || phase === "finalizing";
  const exporting = phase === "zipping" || phase === "rendering";
  const canResume = !isRunning && !exporting && (scenes.length === 0 || incomplete > 0 || cast.some((c) => !c.sheet_url));
  const isReady = project.status === "done" && incomplete === 0 && scenes.length > 0;

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const redoShot = (scene: Scene, kind: "audio" | "image") =>
    withBusy(scene.id + kind, async () => {
      const d: any = await callApi(kind === "audio" ? "/api/tts" : "/api/image", { sceneId: scene.id });
      updateScene(
        scene.id,
        kind === "audio"
          ? { audio_path: d.audio_path, duration_ms: d.duration_ms, status: d.status }
          : { image_path: d.image_path, status: d.status }
      );
      // A new voice take changes the length, so re-time the whole short.
      if (kind === "audio" && scenesRef.current.every((s) => s.audio_path && s.image_path)) {
        await callApi("/api/finalize", { projectId: project.id });
      }
      await refreshAssets();
    });

  const redoCharacter = (c: CharacterAsset) =>
    withBusy("char" + c.id, async () => {
      await callApi("/api/character", { characterId: c.id });
      await refreshAssets();
      setNotice(`${c.name} was redesigned. Redraw the shots they appear in to match.`);
    });

  const downloadImage = (scene: Scene, imageUrl: string) =>
    withBusy(scene.id + "dl", async () => {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Could not download shot ${scene.idx}`);
      let bytes = await res.arrayBuffer();
      let ext = extOfUrl(imageUrl);
      if (ext === "svg") {
        bytes = await svgToPng(bytes, scene.idx);
        ext = "png";
      }
      triggerDownload(new Blob([bytes], { type: mimeForExt(ext) }), `shot_${String(scene.idx).padStart(3, "0")}.${ext}`);
    });

  async function downloadZip() {
    setPhase("zipping");
    setError(null);
    setNotice(null);
    try {
      const data = await refreshAssets();
      if (!data) throw new Error("Could not load the project files");
      const blob = await buildProjectZip(data.assets, data.characters, (p: ZipProgress) =>
        setStatusLine(p.total ? `${p.step} ${p.current}/${p.total}` : p.step)
      );
      triggerDownload(blob, `${project.title.replace(/[^\w-]+/g, "_") || "scenes"}.zip`);

      setStatusLine("Saving a copy to your library…");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const zipPath = `${user.id}/${project.id}/final.zip`;
        const { error: upErr } = await supabase.storage
          .from("assets")
          .upload(zipPath, blob, { contentType: "application/zip", upsert: true });
        if (upErr) {
          setNotice(`Downloaded — but saving a copy to your library failed: ${upErr.message}`);
        } else {
          await callApi(`/api/projects/${project.id}/zip-path`, { zipPath });
          await refreshAssets();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the download");
    } finally {
      setPhase("done");
      setStatusLine("");
    }
  }

  async function downloadVideo() {
    setPhase("rendering");
    setError(null);
    setNotice(null);
    try {
      const data = await refreshAssets();
      if (!data) throw new Error("Could not load the project files");
      const blob = await buildProjectVideo(data.assets, { vertical: isVertical, captions }, (p: VideoProgress) =>
        setStatusLine(p.total ? `${p.step} ${p.current}/${p.total}` : p.step)
      );
      triggerDownload(blob, `${project.title.replace(/[^\w-]+/g, "_") || "scenes"}.mp4`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't render the video");
    } finally {
      setPhase("done");
      setStatusLine("");
    }
  }

  const saveTitle = () =>
    withBusy("title", async () => {
      const d = await callApi<{ project: { title: string } }>(`/api/projects/${project.id}`, { title: titleDraft }, "PATCH");
      setProject((p) => ({ ...p, title: d.project.title }));
      setEditingTitle(false);
    });

  const deleteProject = () => {
    if (!window.confirm(`Delete "${project.title}" and all of its files? This can't be undone.`)) return;
    withBusy("delete", async () => {
      await callApi(`/api/projects/${project.id}`, undefined, "DELETE");
      router.push("/dashboard");
      router.refresh();
    });
  };

  const assetByScene = new Map(assets.map((a) => [a.id, a]));
  const isVertical = project.aspect_ratio !== "16:9";
  const frameClass = isVertical ? "aspect-[9/16]" : "aspect-video";

  return (
    <div>
      {/* Header */}
      <div className="mb-10 border-b border-line pb-10">
        <p className="label mb-4">
          {getStyle(project.style).label} · {isVertical ? "9:16" : "16:9"} · Narrated by {getVoice(project.voice_id).label}
        </p>
        {editingTitle ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xl text-2xl font-semibold"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              autoFocus
            />
            <button onClick={saveTitle} disabled={busy !== null} className="btn-quiet">
              Save
            </button>
            <button onClick={() => setEditingTitle(false)} className="btn-quiet">
              Cancel
            </button>
          </div>
        ) : (
          <h1 className="display text-4xl sm:text-6xl">{project.title}</h1>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap gap-8 font-mono text-sm text-forest-soft">
            <span>
              <span className="label mr-2">Length</span>
              {project.total_duration_ms ? formatClock(project.total_duration_ms) : "—"}
            </span>
            <span>
              <span className="label mr-2">Shots</span>
              {scenes.length || "—"}
            </span>
            <span>
              <span className="label mr-2">Cast</span>
              {cast.length || "—"}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {canResume && (
              <button onClick={run} className="btn-outline">
                {scenes.length === 0 ? "Start" : `Resume · ${incomplete} left`}
              </button>
            )}
            {isReady && videoSupported && (
              <button onClick={downloadVideo} disabled={exporting} className="btn-primary">
                {phase === "rendering" ? "Rendering…" : "Download MP4"}
              </button>
            )}
            {isReady && (
              <button onClick={downloadZip} disabled={exporting} className="btn-outline">
                {phase === "zipping" ? "Packing…" : "Download ZIP"}
              </button>
            )}
            {zipUrl && !exporting && (
              <a href={zipUrl} className="btn-outline">
                Last download
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      {isReady && videoSupported && (
        <div className="-mt-4 mb-10 flex justify-end">
          <label className="flex cursor-pointer items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-forest-soft">
            <input
              type="checkbox"
              checked={captions}
              onChange={(e) => setCaptions(e.target.checked)}
              disabled={exporting}
              className="h-4 w-4 accent-clay"
            />
            Captions in video
          </label>
        </div>
      )}

      {(isRunning || exporting) && (
        <div className="mb-10 rounded-xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-semibold">{PHASE_LABEL[phase]}</p>
            <p className="font-mono text-sm text-forest-soft">{statusLine || "Working…"}</p>
          </div>
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-clay transition-all duration-500"
              style={{
                width: `${
                  exporting
                    ? exportPercent(statusLine)
                    : phase === "storyboard"
                      ? 6
                      : phase === "cast"
                        ? 14
                        : scenes.length
                          ? 14 + (completed / scenes.length) * 84
                          : 10
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-10 rounded-xl border border-clay/40 bg-clay-tint p-6">
          <p className="text-clay-dark">{error}</p>
          {canResume && (
            <button onClick={run} className="btn-quiet mt-4">
              Try again
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="mb-10 rounded-xl border border-line bg-ochre-tint p-6">
          <p>{notice}</p>
        </div>
      )}

      {/* Preview */}
      {isReady && assets.every((a) => a.image_url && a.audio_url) && (
        <Preview assets={assets} vertical={isVertical} />
      )}

      {/* Cast */}
      {cast.length > 0 && (
        <section className="mb-16">
          <p className="label mb-6">Cast — {String(cast.length).padStart(2, "0")}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cast.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl border border-line bg-card">
                <div className="aspect-video bg-forest-tint">
                  {c.sheet_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.sheet_url} alt={`${c.name} reference sheet`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-mono text-xs text-forest-mute">
                      {phase === "cast" ? "Designing…" : "Not drawn yet"}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-forest-soft">{c.look}</p>
                  {!isRunning && (
                    <button onClick={() => redoCharacter(c)} disabled={busy !== null} className="btn-quiet mt-4">
                      {busy === "char" + c.id ? "Redrawing" : "Redraw"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shots */}
      {scenes.length > 0 ? (
        <section>
          <p className="label mb-6">Shots — {String(scenes.length).padStart(2, "0")}</p>
          <div className={`grid gap-5 ${isVertical ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {scenes.map((s) => {
              const a = assetByScene.get(s.id);
              return (
                <div key={s.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-card">
                  <div className={`${frameClass} bg-forest-tint`}>
                    {a?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt={`Shot ${s.idx}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center font-mono text-xs text-forest-mute">
                        {s.image_path ? "Loading" : isRunning ? "Queued" : "No image yet"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center justify-between font-mono text-[11px] text-forest-mute">
                      <span className="text-clay">{String(s.idx).padStart(2, "0")}</span>
                      <span>
                        {s.start_ms != null && `${formatClock(s.start_ms)} · `}
                        {s.duration_ms != null ? `${(s.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </span>
                    </div>
                    <p className="mt-3 flex-1 text-[15px] leading-snug">{s.text}</p>
                    {a?.audio_url && <audio src={a.audio_url} controls preload="none" className="mt-3 h-8 w-full" />}
                    {!isRunning && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => redoShot(s, "image")} disabled={busy !== null} className="btn-quiet">
                          {busy === s.id + "image" ? "Drawing" : "Redraw"}
                        </button>
                        <button onClick={() => redoShot(s, "audio")} disabled={busy !== null} className="btn-quiet">
                          {busy === s.id + "audio" ? "Voicing" : "Re-voice"}
                        </button>
                        {a?.image_url && (
                          <button onClick={() => downloadImage(s, a.image_url!)} disabled={busy !== null} className="btn-quiet">
                            {busy === s.id + "dl" ? "Saving" : "Save"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        !isRunning && (
          <div className="rounded-xl border border-line bg-card px-8 py-16 text-center">
            <p className="lede">Your story is saved. Press Start to storyboard it.</p>
          </div>
        )
      )}

      {/* Danger zone */}
      <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <div className="flex gap-3">
          {!editingTitle && (
            <button onClick={() => setEditingTitle(true)} className="btn-quiet">
              Rename
            </button>
          )}
        </div>
        <button onClick={deleteProject} disabled={busy !== null || isRunning} className="btn-quiet hover:border-clay hover:text-clay">
          {busy === "delete" ? "Deleting" : "Delete project"}
        </button>
      </div>
    </div>
  );
}

/** Rough progress for exports, read from the "Step n/total" status line. */
function exportPercent(status: string): number {
  const m = /(\d+)\/(\d+)/.exec(status);
  if (!m) return status ? 92 : 4;
  const frac = Number(m[1]) / Number(m[2]);
  return /render/i.test(status) ? 25 + frac * 65 : 4 + frac * 20;
}

/** Plays the short in the browser: each shot's image while its audio plays. */
function Preview({ assets, vertical }: { assets: SceneAssetUrls[]; vertical: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shots = [...assets].sort((a, b) => a.idx - b.idx);
  const current = index != null ? shots[index] : shots[0];

  useEffect(() => {
    if (index == null) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = shots[index].audio_url!;
    audio.play().catch(() => setIndex(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Preload the next frame so cuts are instant.
  const next = index != null ? shots[index + 1] : undefined;

  return (
    <section className="mb-16 grid items-center gap-10 rounded-xl border border-line bg-forest p-6 text-paper sm:p-10 lg:grid-cols-[auto_1fr]">
      <div className={`${vertical ? "aspect-[9/16] w-56 sm:w-64" : "aspect-video w-full max-w-xl"} overflow-hidden rounded-md bg-forest-deep`}>
        {current?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.image_url} alt="" className="h-full w-full object-cover" />
        )}
        {next?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={next.image_url} alt="" className="hidden" />
        )}
      </div>
      <div>
        <p className="label mb-4 text-paper/60">Preview</p>
        <p className="display min-h-[4.5rem] text-2xl text-paper sm:text-3xl">{current?.text}</p>
        <div className="mt-8 flex items-center gap-6">
          {index == null ? (
            <button onClick={() => setIndex(0)} className="btn border-ochre bg-ochre text-forest hover:bg-ochre/90">
              Play the short
            </button>
          ) : (
            <button
              onClick={() => {
                audioRef.current?.pause();
                setIndex(null);
              }}
              className="btn border-paper/40 text-paper hover:bg-paper/10"
            >
              Stop
            </button>
          )}
          <span className="font-mono text-sm text-paper/60">
            {index != null ? `${String(index + 1).padStart(2, "0")} / ${String(shots.length).padStart(2, "0")}` : `${shots.length} shots`}
          </span>
        </div>
        <audio
          ref={audioRef}
          onEnded={() => setIndex((i) => (i != null && i + 1 < shots.length ? i + 1 : null))}
          className="hidden"
        />
      </div>
    </section>
  );
}
