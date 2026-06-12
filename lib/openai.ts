// REST wrappers for the OpenAI API (BYOK, server-side only).
// OpenAI covers TTS + images when the user has a key; Gemini stays the
// (free) default for script-splitting.

import { GeminiError } from "./gemini";

// Shares the base class so withRetry/handleRouteError treat both providers alike.
export class OpenAIError extends GeminiError {}

const BASE = "https://api.openai.com/v1";

export const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini";
export const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
// "low" keeps a 60-image video around $1; bump via env if you want crisper frames.
const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY ?? "low";

async function call(apiKey: string, path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message ?? "";
    } catch {}
    throw new OpenAIError(detail || `OpenAI ${path} returned ${res.status}`, res.status);
  }
  return res;
}

export async function validateOpenAIKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new OpenAIError(
      res.status === 401
        ? "OpenAI rejected this API key. Double-check it at platform.openai.com/api-keys."
        : `Key validation failed (HTTP ${res.status})`,
      res.status
    );
  }
}

export async function openaiGenerateJson(apiKey: string, prompt: string): Promise<string> {
  const res = await call(apiKey, "/chat/completions", {
    model: OPENAI_TEXT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new OpenAIError("OpenAI returned an empty response", 502);
  return text;
}

/** Single-speaker TTS. Returns a complete WAV file (24kHz mono). */
export async function openaiSpeech(
  apiKey: string,
  text: string,
  voice: string,
  instructions: string
): Promise<Buffer> {
  const res = await call(apiKey, "/audio/speech", {
    model: OPENAI_TTS_MODEL,
    voice,
    input: text,
    instructions,
    response_format: "wav",
  });
  return Buffer.from(await res.arrayBuffer());
}

/** Image generation. Returns PNG bytes. */
export async function openaiImage(
  apiKey: string,
  prompt: string,
  aspectRatio: "16:9" | "9:16"
): Promise<Buffer> {
  const isDallE = OPENAI_IMAGE_MODEL.startsWith("dall-e");
  const size = isDallE
    ? aspectRatio === "9:16"
      ? "1024x1792"
      : "1792x1024"
    : aspectRatio === "9:16"
      ? "1024x1536"
      : "1536x1024";
  const body: Record<string, unknown> = {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size,
    n: 1,
  };
  if (isDallE) {
    body.quality = "standard";
    body.response_format = "b64_json";
  } else {
    body.quality = IMAGE_QUALITY;
  }
  const res = await call(apiKey, "/images/generations", body);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new OpenAIError("OpenAI returned no image", 502);
  return Buffer.from(b64, "base64");
}
