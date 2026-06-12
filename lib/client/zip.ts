"use client";

import JSZip from "jszip";
import { wavsToMp3 } from "./audio";
import type { SceneAssetUrls } from "@/lib/types";

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const README = `HOW TO ASSEMBLE IN CAPCUT
1. New project -> import audio.mp3 + all images.
2. Drag audio.mp3 to the timeline first.
3. Drag images in order. Each filename = the time it should START.
   e.g. 004_01m12s.png starts at 1:12. Stretch each image until the next one.
4. timeline.csv has exact start/end/duration per scene if you want precision.
5. Add captions, export 1080p. Done.
`;

export interface ZipProgress {
  step: string;
  current?: number;
  total?: number;
}

/** Fetch all assets, build audio.mp3 + images + timeline.csv + readme.txt into a ZIP blob. */
export async function buildProjectZip(
  assets: SceneAssetUrls[],
  onProgress: (p: ZipProgress) => void
): Promise<Blob> {
  const scenes = [...assets].sort((a, b) => a.idx - b.idx);
  const missing = scenes.filter((s) => !s.audio_url || !s.image_url || s.start_ms == null);
  if (missing.length > 0) {
    throw new Error(`Scene ${missing[0].idx} is missing assets — regenerate it and finalize again.`);
  }

  // Beats in one audio chunk share a file (same storage path, different signed
  // tokens) — download each chunk once, in order.
  const pathOf = (u: string) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  };
  const audioScenes = scenes.filter(
    (s, i) => i === 0 || pathOf(s.audio_url!) !== pathOf(scenes[i - 1].audio_url!)
  );
  onProgress({ step: "Downloading audio", current: 0, total: audioScenes.length });
  const wavBuffers: ArrayBuffer[] = [];
  for (let i = 0; i < audioScenes.length; i++) {
    const res = await fetch(audioScenes[i].audio_url!);
    if (!res.ok) throw new Error(`Failed to download audio for scene ${audioScenes[i].idx}`);
    wavBuffers.push(await res.arrayBuffer());
    onProgress({ step: "Downloading audio", current: i + 1, total: audioScenes.length });
  }

  onProgress({ step: "Encoding MP3" });
  const mp3 = wavsToMp3(wavBuffers);

  const zip = new JSZip();
  zip.file("audio.mp3", mp3);
  zip.file("readme.txt", README);

  const images = zip.folder("images")!;
  onProgress({ step: "Downloading images", current: 0, total: scenes.length });
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const res = await fetch(s.image_url!);
    if (!res.ok) throw new Error(`Failed to download image for scene ${s.idx}`);
    let bytes = await res.arrayBuffer();
    let ext = s.image_url!.includes(".jpg") ? "jpg" : s.image_url!.includes(".svg") ? "svg" : "png";
    if (ext === "svg") {
      // Video editors don't take SVG — rasterize in the browser, where fonts exist.
      bytes = await svgToPng(bytes, s.idx);
      ext = "png";
    }
    images.file(`${String(s.idx).padStart(3, "0")}_${formatTimestamp(s.start_ms!)}.${ext}`, bytes);
    onProgress({ step: "Downloading images", current: i + 1, total: scenes.length });
  }

  const csvRows = ["scene,start,end,duration_seconds,text"];
  for (const s of scenes) {
    const end = s.start_ms! + (s.duration_ms ?? 0);
    csvRows.push(
      [
        String(s.idx),
        formatClock(s.start_ms!),
        formatClock(end),
        ((s.duration_ms ?? 0) / 1000).toFixed(2),
        csvEscape(s.text),
      ].join(",")
    );
  }
  zip.file("timeline.csv", csvRows.join("\n") + "\n");

  onProgress({ step: "Packaging ZIP" });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** Rasterize a self-contained SVG to PNG via an offscreen canvas. */
export async function svgToPng(svgBytes: ArrayBuffer, idx: number): Promise<ArrayBuffer> {
  const blob = new Blob([svgBytes], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Scene ${idx}: SVG image failed to load`));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 1344;
    canvas.height = img.naturalHeight || 768;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Scene ${idx}: PNG encode failed`))), "image/png")
    );
    return png.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
