import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  jsonError,
  handleRouteError,
  getUserGeminiKey,
  NO_KEY_MESSAGE,
} from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSpeech, withRetry } from "@/lib/gemini";
import { getVoice, VOICES, PREVIEW_SENTENCE } from "@/lib/voices";
import { ttsPrompt } from "@/lib/prompts";
import { parseRateFromMime, pcmToWav } from "@/lib/wav";

export const runtime = "nodejs";
export const maxDuration = 60;

// Previews are cached app-wide: the first user to preview a voice generates
// it (on their key); everyone after gets the cached WAV for free.
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireUser();
    if (error) return error;

    const { voiceId } = await req.json();
    if (!VOICES.some((v) => v.id === voiceId)) return jsonError("Unknown voice", 400);

    const path = `previews/${voiceId}.wav`;
    const admin = createAdminClient();

    const { data: existing } = await admin.storage.from("assets").list("previews", {
      search: `${voiceId}.wav`,
    });
    if (!existing?.some((f) => f.name === `${voiceId}.wav`)) {
      const apiKey = await getUserGeminiKey(user.id);
      if (!apiKey) return jsonError(NO_KEY_MESSAGE, 400);
      const voice = getVoice(voiceId);
      const { pcm, mimeType } = await withRetry(() =>
        generateSpeech(apiKey, ttsPrompt(voice.style, PREVIEW_SENTENCE), voice.id)
      );
      const wav = pcmToWav(pcm, parseRateFromMime(mimeType));
      const { error: uploadError } = await admin.storage
        .from("assets")
        .upload(path, wav, { contentType: "audio/wav", upsert: true });
      if (uploadError) return jsonError(uploadError.message, 500);
    }

    const { data: signed, error: signError } = await admin.storage
      .from("assets")
      .createSignedUrl(path, 3600);
    if (signError || !signed) return jsonError("Could not sign preview URL", 500);

    return NextResponse.json({ url: signed.signedUrl });
  } catch (e) {
    return handleRouteError(e);
  }
}
