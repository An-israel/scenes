// Deepgram Aura TTS (BYOK). New accounts get $200 free credit with no card,
// which covers ~100+ hours of narration — the recommended free voice engine.

import { GeminiError } from "./gemini";

// Shares the base class so withRetry/handleRouteError treat providers alike.
export class DeepgramError extends GeminiError {}

const BASE = "https://api.deepgram.com/v1";

export async function validateDeepgramKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/projects`, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!res.ok) {
    throw new DeepgramError(
      res.status === 401 || res.status === 403
        ? "Deepgram rejected this API key. Create one at console.deepgram.com under API Keys."
        : `Key validation failed (HTTP ${res.status})`,
      res.status
    );
  }
}

/** TTS. Returns a complete WAV file (24kHz mono linear16). Max ~2000 chars. */
export async function deepgramSpeech(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const params = new URLSearchParams({
    model: voice,
    encoding: "linear16",
    sample_rate: "24000",
    container: "wav",
  });
  const res = await fetch(`${BASE}/speak?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.err_msg ?? j?.message ?? "";
    } catch {}
    throw new DeepgramError(detail || `Deepgram TTS returned ${res.status}`, res.status);
  }
  return Buffer.from(await res.arrayBuffer());
}
