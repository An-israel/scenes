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
import { ttsPrompt } from "@/lib/prompts";
import { getVoice } from "@/lib/voices";
import { parseRateFromMime, pcmToWav, pcmDurationMs } from "@/lib/wav";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireUser();
    if (error) return error;

    const { sceneId } = await req.json();

    // RLS guarantees the scene belongs to the caller.
    const { data: scene } = await supabase
      .from("scenes")
      .select("*, projects!inner(id, user_id, voice_id)")
      .eq("id", sceneId)
      .single();
    if (!scene) return jsonError("Scene not found", 404);

    const apiKey = await getUserGeminiKey(user.id);
    if (!apiKey) return jsonError(NO_KEY_MESSAGE, 400);

    const voice = getVoice((scene as any).projects.voice_id);
    const { pcm, mimeType } = await withRetry(() =>
      generateSpeech(apiKey, ttsPrompt(voice.style, scene.text), voice.id)
    );
    const rate = parseRateFromMime(mimeType);
    const wav = pcmToWav(pcm, rate);
    const durationMs = pcmDurationMs(pcm.length, rate);

    const path = `${user.id}/${scene.project_id}/scene_${String(scene.idx).padStart(3, "0")}.wav`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("assets")
      .upload(path, wav, { contentType: "audio/wav", upsert: true });
    if (uploadError) return jsonError(`Storage upload failed: ${uploadError.message}`, 500);

    const newStatus = scene.image_path ? "done" : "audio_done";
    const { error: updateError } = await supabase
      .from("scenes")
      .update({ audio_path: path, duration_ms: durationMs, status: newStatus })
      .eq("id", sceneId);
    if (updateError) return jsonError(updateError.message, 500);

    return NextResponse.json({ ok: true, audio_path: path, duration_ms: durationMs, status: newStatus });
  } catch (e) {
    return handleRouteError(e);
  }
}
