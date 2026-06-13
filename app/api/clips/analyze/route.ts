import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  jsonError,
  handleRouteError,
  getUserKeys,
  NO_KEY_MESSAGE,
} from "@/lib/api-helpers";
import { analyzeYouTube, withRetry } from "@/lib/gemini";
import { clipFinderPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Clip {
  start: string;
  end: string;
  start_seconds: number;
  end_seconds: number;
  title: string;
  reason: string;
  transcript: string;
}

/** Pull the 11-char video id out of any common YouTube URL shape. */
function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]{11})/, // watch?v=
    /youtu\.be\/([\w-]{11})/, // short link
    /\/shorts\/([\w-]{11})/, // shorts
    /\/embed\/([\w-]{11})/, // embed
    /\/live\/([\w-]{11})/, // live
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  // Bare id pasted on its own.
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireUser();
    if (error) return error;

    const { url, count, minSec, maxSec } = await req.json();

    const videoId = extractVideoId(typeof url === "string" ? url : "");
    if (!videoId) {
      return jsonError("That doesn't look like a YouTube link. Paste a full youtube.com or youtu.be URL.", 400);
    }
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const n = Math.min(Math.max(Number(count) || 10, 1), 20);
    const lo = Math.min(Math.max(Number(minSec) || 20, 5), 600);
    const hi = Math.min(Math.max(Number(maxSec) || 60, lo + 5), 900);

    // Only the free Gemini key can analyze YouTube videos directly.
    const keys = await getUserKeys(user.id);
    if (!keys.gemini) {
      return jsonError(
        "Clip Finder needs your free Google Gemini key (it can watch YouTube directly). Add it in Settings.",
        400
      );
    }

    let raw: string;
    try {
      raw = await withRetry(() =>
        analyzeYouTube(keys.gemini!, canonicalUrl, clipFinderPrompt(n, lo, hi))
      );
    } catch (e: any) {
      // Common, user-fixable failure modes get a friendlier message.
      const msg = e?.message ?? "";
      if (/quota|rate|429/i.test(msg)) {
        return jsonError("Daily free Gemini limit reached for video analysis — try again tomorrow.", 429);
      }
      if (/private|forbidden|permission|unsupported|not.*found|400/i.test(msg)) {
        return jsonError(
          "Couldn't analyze that video. It must be PUBLIC (not private/unlisted) and not age-restricted. Very long videos may also be rejected.",
          422
        );
      }
      throw e;
    }

    const clips = parseClips(raw);
    if (clips.length === 0) {
      return jsonError("The analyzer didn't return any clips — try a different video.", 502);
    }

    return NextResponse.json({
      videoId,
      url: canonicalUrl,
      clips,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

function toSeconds(s: string): number {
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

function parseClips(raw: string): Clip[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed?.clips) ? parsed.clips : Array.isArray(parsed) ? parsed : [];
  return list
    .map((c: any): Clip | null => {
      if (!c) return null;
      // Trust whichever of {seconds, M:SS} the model gave; reconcile both.
      const startSec = Number.isFinite(c.start_seconds) ? Number(c.start_seconds) : toSeconds(String(c.start ?? ""));
      const endSec = Number.isFinite(c.end_seconds) ? Number(c.end_seconds) : toSeconds(String(c.end ?? ""));
      if (endSec <= startSec) return null;
      return {
        start: fmt(startSec),
        end: fmt(endSec),
        start_seconds: Math.round(startSec),
        end_seconds: Math.round(endSec),
        title: String(c.title ?? "").trim() || "Untitled clip",
        reason: String(c.reason ?? "").trim(),
        transcript: String(c.transcript ?? "").trim(),
      };
    })
    .filter((c: Clip | null): c is Clip => c !== null);
}
