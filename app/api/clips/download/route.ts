import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Pull the 11-char video id out of any common YouTube URL shape. */
function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /\/shorts\/([\w-]{11})/,
    /\/embed\/([\w-]{11})/,
    /\/live\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

// Cobalt download relays do the fetch + audio/video merge and stream the file
// straight to the user's browser, so nothing heavy runs on our server. Point
// COBALT_INSTANCE at your own self-hosted cobalt for 100% reliability; the
// community defaults are best-effort (they can be busy or rate-limited).
const INSTANCES = (
  process.env.COBALT_INSTANCE
    ? [process.env.COBALT_INSTANCE]
    : ["https://cobalt-api.kwiatekmiki.com", "https://cobalt-api.meowing.de"]
).map((s) => s.replace(/\/+$/, ""));

const API_KEY = process.env.COBALT_API_KEY;

function host(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireUser();
    if (error) return error;

    const { url, quality } = await req.json();
    const videoId = extractVideoId(typeof url === "string" ? url : "");
    if (!videoId) return jsonError("That doesn't look like a YouTube link.", 400);

    const q = quality === "1080" ? "1080" : "720";
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const failures: string[] = [];
    for (const instance of INSTANCES) {
      try {
        const res = await fetch(`${instance}/`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(API_KEY ? { Authorization: `Api-Key ${API_KEY}` } : {}),
          },
          body: JSON.stringify({
            url: canonicalUrl,
            videoQuality: q,
            // h264/mp4 = maximum compatibility with CapCut and caps at 1080p.
            youtubeVideoCodec: "h264",
            filenameStyle: "basic",
            downloadMode: "auto",
          }),
          signal: AbortSignal.timeout(25_000),
        });
        const data: any = await res.json().catch(() => ({}));
        const status = data?.status;

        if ((status === "tunnel" || status === "redirect" || status === "stream") && data.url) {
          return NextResponse.json({
            url: data.url,
            filename: data.filename ?? `${videoId}_${q}p.mp4`,
            quality: q,
          });
        }
        if (status === "picker" && Array.isArray(data.picker)) {
          const vid = data.picker.find((p: any) => p.type === "video" || p.url) ?? data.picker[0];
          if (vid?.url) {
            return NextResponse.json({ url: vid.url, filename: `${videoId}_${q}p.mp4`, quality: q });
          }
        }
        failures.push(`${host(instance)}: ${data?.error?.code ?? status ?? res.status}`);
      } catch (e: any) {
        failures.push(`${host(instance)}: ${e?.name === "TimeoutError" ? "timed out" : e?.message ?? "unreachable"}`);
      }
    }

    return jsonError(
      `The free download relays were busy or blocked just now (${failures.join("; ")}). ` +
        `Try again in a minute. For rock-solid downloads, host your own cobalt and set COBALT_INSTANCE.`,
      503
    );
  } catch (e) {
    return handleRouteError(e);
  }
}
