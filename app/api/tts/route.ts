import { NextRequest, NextResponse } from "next/server";
import { requireMember, jsonError, handleRouteError, geminiKey } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSpeech, withRetry } from "@/lib/gemini";
import { ttsPrompt } from "@/lib/prompts";
import { getVoice } from "@/lib/voices";
import { parseRateFromMime, pcmToWav, pcmDurationMs, trimSilence } from "@/lib/wav";
import { markDoneIfComplete } from "@/lib/scenes";

export const runtime = "nodejs";
export const maxDuration = 60;

// Voices one shot with the project's voice. Each shot gets its own clip, so
// its duration (and every image timestamp) is exact.
export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireMember();
    if (error) return error;

    const { sceneId } = await req.json();
    const { data: scene } = await supabase
      .from("scenes")
      .select("*, projects!inner(id, voice_id)")
      .eq("id", sceneId)
      .single();
    if (!scene) return jsonError("Scene not found", 404);

    const voice = getVoice((scene as any).projects.voice_id);
    const { pcm, mimeType } = await withRetry(() =>
      generateSpeech(geminiKey(), ttsPrompt(voice.style, scene.text), voice.id)
    );
    const rate = parseRateFromMime(mimeType);
    const trimmed = trimSilence(pcm, rate);
    const wav = pcmToWav(trimmed, rate);
    const durationMs = pcmDurationMs(trimmed.length, rate);

    const path = `${user.id}/${scene.project_id}/scene_${String(scene.idx).padStart(3, "0")}.wav`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("assets")
      .upload(path, wav, { contentType: "audio/wav", upsert: true });
    if (uploadError) return jsonError(`Storage upload failed: ${uploadError.message}`, 500);

    const { error: updateError } = await supabase
      .from("scenes")
      .update({ audio_path: path, duration_ms: durationMs })
      .eq("id", sceneId);
    if (updateError) return jsonError(updateError.message, 500);
    const status = await markDoneIfComplete(supabase, sceneId);

    return NextResponse.json({ ok: true, audio_path: path, duration_ms: durationMs, status });
  } catch (e) {
    return handleRouteError(e);
  }
}
