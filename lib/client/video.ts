"use client";

// In-browser MP4 export: each shot's image fills the frame with a slow zoom
// while its narration plays, optional captions are drawn on top, and the whole
// thing is encoded with WebCodecs (via mediabunny). Nothing touches a server.

import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import { parseWav } from "./audio";
import type { SceneAssetUrls } from "@/lib/types";

const FPS = 30;
const AUDIO_RATE = 48000; // AAC encoders want 44.1/48 kHz; narration is resampled
const ZOOM = 0.08; // each shot grows or shrinks by 8% over its duration

export interface VideoProgress {
  step: string;
  current?: number;
  total?: number;
}

export interface VideoOptions {
  vertical: boolean;
  captions: boolean;
}

export function canExportVideo(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "AudioEncoder" in window;
}

export async function buildProjectVideo(
  assets: SceneAssetUrls[],
  options: VideoOptions,
  onProgress: (p: VideoProgress) => void
): Promise<Blob> {
  if (!canExportVideo()) {
    throw new Error("This browser can't encode video. Use a recent Chrome, Edge or Safari, or download the ZIP instead.");
  }
  const shots = [...assets].sort((a, b) => a.idx - b.idx);
  const missing = shots.find((s) => !s.image_url || !s.audio_url);
  if (missing) throw new Error(`Shot ${missing.idx} is missing its audio or image — regenerate it first.`);

  const [width, height] = options.vertical ? [1080, 1920] : [1920, 1080];

  // 1. Download everything.
  onProgress({ step: "Loading shots", current: 0, total: shots.length });
  const images: ImageBitmap[] = [];
  const wavs: ArrayBuffer[] = [];
  for (let i = 0; i < shots.length; i++) {
    const [img, wav] = await Promise.all([
      fetch(shots[i].image_url!).then((r) => {
        if (!r.ok) throw new Error(`Couldn't load the image for shot ${shots[i].idx}`);
        return r.blob();
      }),
      fetch(shots[i].audio_url!).then((r) => {
        if (!r.ok) throw new Error(`Couldn't load the audio for shot ${shots[i].idx}`);
        return r.arrayBuffer();
      }),
    ]);
    images.push(await createImageBitmap(img));
    wavs.push(wav);
    onProgress({ step: "Loading shots", current: i + 1, total: shots.length });
  }

  // 2. One continuous narration track; shot lengths come from the real audio.
  onProgress({ step: "Preparing audio" });
  const { buffer: narration, durations } = await joinNarration(wavs);

  // 3. Pick codecs the browser can actually encode (H.264 first for editors/socials).
  const videoCodec = await getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"], { width, height });
  const audioCodec = await getFirstEncodableAudioCodec(["aac", "opus"], {
    numberOfChannels: 1,
    sampleRate: AUDIO_RATE,
  });
  if (!videoCodec || !audioCodec) {
    throw new Error("This browser can't encode MP4 video. Try Chrome or Edge, or download the ZIP instead.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  if (options.captions) await document.fonts.load(`600 ${captionSize(width)}px "Inter Tight Variable"`);

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const video = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_HIGH });
  const audio = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH });
  output.addVideoTrack(video, { frameRate: FPS });
  output.addAudioTrack(audio);
  await output.start();

  // 4. Render frames. Frame boundaries are rounded from cumulative time so the
  //    picture never drifts from the narration.
  const totalSeconds = durations.reduce((a, b) => a + b, 0);
  const totalFrames = Math.round(totalSeconds * FPS);
  let shotStart = 0;
  let frame = 0;
  for (let i = 0; i < shots.length; i++) {
    const shotEnd = shotStart + durations[i];
    const lastFrame = i === shots.length - 1 ? totalFrames : Math.round(shotEnd * FPS);
    const firstFrame = frame;
    const span = Math.max(1, lastFrame - firstFrame);
    for (; frame < lastFrame; frame++) {
      const t = (frame - firstFrame) / span;
      drawShot(ctx, images[i], width, height, t, i);
      if (options.captions) drawCaption(ctx, shots[i].text, width, height);
      await video.add(frame / FPS, 1 / FPS);
    }
    shotStart = shotEnd;
    onProgress({ step: "Rendering video", current: i + 1, total: shots.length });
  }
  video.close();

  onProgress({ step: "Encoding audio" });
  await audio.add(narration);
  audio.close();

  onProgress({ step: "Finishing file" });
  await output.finalize();
  images.forEach((b) => b.close());

  const bytes = (output.target as BufferTarget).buffer;
  if (!bytes) throw new Error("The video encoder produced no output.");
  return new Blob([bytes], { type: "video/mp4" });
}

/** Concatenate the shot WAVs and resample to 48 kHz. Returns each shot's length in seconds. */
async function joinNarration(wavs: ArrayBuffer[]): Promise<{ buffer: AudioBuffer; durations: number[] }> {
  const parsed = wavs.map(parseWav);
  const sourceRate = parsed[0].sampleRate;
  const durations = parsed.map((p) => p.samples.length / p.channels / p.sampleRate);
  const total = parsed.reduce((n, p) => n + p.samples.length / p.channels, 0);

  const joined = new AudioBuffer({ length: Math.max(1, total), numberOfChannels: 1, sampleRate: sourceRate });
  const data = joined.getChannelData(0);
  let pos = 0;
  for (const p of parsed) {
    if (p.sampleRate !== sourceRate) throw new Error("Shot audio formats differ — re-voice the mismatched shot.");
    const frames = p.samples.length / p.channels;
    for (let f = 0; f < frames; f++) data[pos + f] = p.samples[f * p.channels] / 32768;
    pos += frames;
  }

  const offline = new OfflineAudioContext(1, Math.ceil((total / sourceRate) * AUDIO_RATE), AUDIO_RATE);
  const src = offline.createBufferSource();
  src.buffer = joined;
  src.connect(offline.destination);
  src.start();
  return { buffer: await offline.startRendering(), durations };
}

/** Cover-fit the image and apply a gentle zoom, alternating in and out per shot. */
function drawShot(ctx: CanvasRenderingContext2D, img: ImageBitmap, w: number, h: number, t: number, index: number) {
  const ease = t * t * (3 - 2 * t);
  const zoom = index % 2 === 0 ? 1 + ZOOM * ease : 1 + ZOOM * (1 - ease);
  const cover = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * cover;
  const dh = img.height * cover;
  // A slight drift sideways keeps the frame alive without feeling like a slideshow.
  const drift = (index % 3 === 1 ? -1 : index % 3 === 2 ? 1 : 0) * (dw - w) * 0.25 * ease;
  ctx.fillStyle = "#172C23";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, (w - dw) / 2 + drift, (h - dh) / 2, dw, dh);
}

function captionSize(width: number) {
  return Math.round(width * 0.052);
}

/** Bottom-third caption: bold white type with a soft shadow, wrapped to 2–3 lines. */
function drawCaption(ctx: CanvasRenderingContext2D, text: string, w: number, h: number) {
  const size = captionSize(w);
  ctx.font = `600 ${size}px "Inter Tight Variable", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const maxWidth = w * 0.82;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const lineHeight = size * 1.2;
  const bottom = h * (w < h ? 0.8 : 0.88);
  const top = bottom - (lines.length - 1) * lineHeight;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = size * 0.35;
  ctx.shadowOffsetY = size * 0.06;
  ctx.fillStyle = "#FFFDF9";
  lines.forEach((l, i) => ctx.fillText(l, w / 2, top + i * lineHeight));
  ctx.restore();
}
