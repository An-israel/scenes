import { NextRequest, NextResponse } from "next/server";
import { requireMember, jsonError, handleRouteError, geminiKey } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSpeech, withRetry } from "@/lib/gemini";
import { getVoice, isKnownVoice, PREVIEW_SENTENCE } from "@/lib/voices";
import { ttsPrompt } from "@/lib/prompts";
import { parseRateFromMime, pcmToWav, trimSilence } from "@/lib/wav";

export const runtime = "nodejs";
export const maxDuration = 60;

// Previews are generated once per voice and cached for everyone.
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireMember();
    if (error) return error;

    const { voiceId } = await req.json();
    if (!isKnownVoice(voiceId)) return jsonError("Unknown voice", 400);

    const path = `previews/story_${voiceId}.wav`;
    const admin = createAdminClient();

    const { data: existing } = await admin.storage.from("assets").list("previews", {
      search: `story_${voiceId}.wav`,
    });
    if (!existing?.some((f) => f.name === `story_${voiceId}.wav`)) {
      const voice = getVoice(voiceId);
      const { pcm, mimeType } = await withRetry(() =>
        generateSpeech(geminiKey(), ttsPrompt(voice.style, PREVIEW_SENTENCE), voice.id)
      );
      const rate = parseRateFromMime(mimeType);
      const { error: uploadError } = await admin.storage
        .from("assets")
        .upload(path, pcmToWav(trimSilence(pcm, rate), rate), { contentType: "audio/wav", upsert: true });
      if (uploadError) return jsonError(uploadError.message, 500);
    }

    const { data: signed, error: signError } = await admin.storage.from("assets").createSignedUrl(path, 3600);
    if (signError || !signed) return jsonError("Could not sign preview URL", 500);

    return NextResponse.json({ url: signed.signedUrl });
  } catch (e) {
    return handleRouteError(e);
  }
}
