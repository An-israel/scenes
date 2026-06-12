// Thin REST wrappers around the Gemini API. All calls run server-side with
// the user's own decrypted key (BYOK) — keys never reach the client.

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
// SVG art uses flash-lite: 4x the free daily quota, plenty for simple vectors.
export const ART_MODEL = process.env.GEMINI_ART_MODEL ?? "gemini-2.5-flash-lite";
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function callModel(apiKey: string, model: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message ?? "";
    } catch {}
    throw new GeminiError(detail || `Gemini ${model} returned ${res.status}`, res.status);
  }
  return res.json();
}

/** Cheap key check: list models (no quota consumed). */
export async function validateKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/models?pageSize=1`, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!res.ok) {
    throw new GeminiError(
      res.status === 400 || res.status === 403
        ? "Google rejected this API key. Double-check it in AI Studio."
        : `Key validation failed (HTTP ${res.status})`,
      res.status
    );
  }
}

/** Plain text generation (scene split). Forces JSON output. */
export async function generateJson(apiKey: string, prompt: string): Promise<string> {
  const data = await callModel(apiKey, TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text ?? "")
    .join("");
  if (!text) throw new GeminiError("Gemini returned an empty response", 502);
  return text;
}

/** Free-form text generation (no JSON forcing) — used for SVG scene art. */
export async function generateText(apiKey: string, prompt: string): Promise<string> {
  const data = await callModel(apiKey, ART_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 },
  });
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text ?? "")
    .join("");
  if (!text) throw new GeminiError("Gemini returned an empty response", 502);
  return text;
}

/** Single-speaker TTS. Returns raw PCM plus its mime type (carries sample rate). */
export async function generateSpeech(
  apiKey: string,
  text: string,
  voiceName: string
): Promise<{ pcm: Buffer; mimeType: string }> {
  const data = await callModel(apiKey, TTS_MODEL, {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });
  const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  if (!part?.inlineData?.data) throw new GeminiError("TTS returned no audio", 502);
  return {
    pcm: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType ?? "audio/L16;codec=pcm;rate=24000",
  };
}

/** Image generation with the locked style prompt already applied. */
export async function generateImage(
  apiKey: string,
  prompt: string,
  aspectRatio: "16:9" | "9:16" = "16:9"
): Promise<{ bytes: Buffer; mimeType: string }> {
  const data = await callModel(apiKey, IMAGE_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio },
    },
  });
  const part = data?.candidates?.[0]?.content?.parts?.find((p: any) =>
    p.inlineData?.mimeType?.startsWith("image/")
  );
  if (!part?.inlineData?.data) throw new GeminiError("Image model returned no image", 502);
  return {
    bytes: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType,
  };
}

/** One server-side retry on 429/5xx so transient blips don't bubble up. */
export async function withRetry<T>(fn: () => Promise<T>, waitMs = 2000): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GeminiError && (e.status === 429 || e.status >= 500)) {
      await new Promise((r) => setTimeout(r, waitMs));
      return fn();
    }
    throw e;
  }
}
