// Pollinations.ai — free, keyless image generation (flux model).
// Used automatically when the user has no OpenAI key, since Google's
// free tier no longer includes image generation.

import { GeminiError } from "./gemini";

// Shares the base class so withRetry/handleRouteError treat providers alike.
export class PollinationsError extends GeminiError {}

export async function pollinationsImage(
  prompt: string,
  aspectRatio: "16:9" | "9:16"
): Promise<{ bytes: Buffer; mimeType: string }> {
  const [width, height] = aspectRatio === "9:16" ? [768, 1344] : [1344, 768];
  // Random seed so regenerating a scene actually produces a different image.
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}&referrer=sceneforge`;

  const res = await fetch(url, {
    headers: { "User-Agent": "SceneForge/1.0" },
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    throw new PollinationsError(
      `Free image service returned ${res.status} — it can get busy; retrying usually works.`,
      res.status
    );
  }
  const mimeType = res.headers.get("content-type") ?? "";
  if (!mimeType.startsWith("image/")) {
    throw new PollinationsError("Free image service returned a non-image response.", 503);
  }
  return { bytes: Buffer.from(await res.arrayBuffer()), mimeType };
}
