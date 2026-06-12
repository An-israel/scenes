import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  jsonError,
  handleRouteError,
  getUserKeys,
  NO_KEY_MESSAGE,
} from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSpeech, withRetry } from "@/lib/gemini";
import { openaiSpeech } from "@/lib/openai";
import { deepgramSpeech } from "@/lib/deepgram";
import { ttsPrompt } from "@/lib/prompts";
import { getVoice, getOpenAIVoice, getDeepgramVoice, OPENAI_VOICES } from "@/lib/voices";
import { parseRateFromMime, pcmToWav, pcmDurationMs, wavDurationMs } from "@/lib/wav";

export const runtime = "nodejs";
export const maxDuration = 60;

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

// Voices a whole audio chunk (all beats sharing chunk_idx) in ONE provider
// call, then splits the real duration across the beats by word count.
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

    // Gather the chunk. Legacy scenes (pre-migration) have no chunk_idx and
    // remain their own one-beat chunk.
    let members: any[] = [scene];
    if (scene.chunk_idx != null) {
      const { data } = await supabase
        .from("scenes")
        .select("*")
        .eq("project_id", scene.project_id)
        .eq("chunk_idx", scene.chunk_idx)
        .order("idx");
      if (data && data.length > 0) members = data;
    }
    const chunkText = members.map((m) => m.text).join(" ");
    const projectVoice = (scene as any).projects.voice_id as string;

    const keys = await getUserKeys(user.id);

    let wav: Buffer;
    let totalMs: number;
    if (keys.openai) {
      const voice = OPENAI_VOICES.some((v) => v.id === projectVoice)
        ? getOpenAIVoice(projectVoice)
        : getOpenAIVoice("onyx");
      wav = await withRetry(() =>
        openaiSpeech(
          keys.openai!,
          chunkText,
          voice.id,
          `Narrate in a ${voice.style} tone. Natural pace, clear diction.`
        )
      );
      totalMs = wavDurationMs(wav);
    } else if (keys.deepgram) {
      const voice = getDeepgramVoice(projectVoice);
      wav = await withRetry(() => deepgramSpeech(keys.deepgram!, chunkText, voice.id));
      totalMs = wavDurationMs(wav);
    } else if (keys.gemini) {
      const voice = getVoice(projectVoice);
      const { pcm, mimeType } = await withRetry(() =>
        generateSpeech(keys.gemini!, ttsPrompt(voice.style, chunkText), voice.id)
      );
      const rate = parseRateFromMime(mimeType);
      wav = pcmToWav(pcm, rate);
      totalMs = pcmDurationMs(pcm.length, rate);
    } else {
      return jsonError(NO_KEY_MESSAGE, 400);
    }

    const fileStem =
      scene.chunk_idx != null
        ? `chunk_${String(scene.chunk_idx).padStart(3, "0")}`
        : `scene_${String(scene.idx).padStart(3, "0")}`;
    const path = `${user.id}/${scene.project_id}/${fileStem}.wav`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("assets")
      .upload(path, wav, { contentType: "audio/wav", upsert: true });
    if (uploadError) return jsonError(`Storage upload failed: ${uploadError.message}`, 500);

    // Allocate the chunk's real duration across beats by word share; the last
    // beat absorbs rounding so the totals stay exact.
    const words = members.map((m) => Math.max(1, countWords(m.text)));
    const totalWords = words.reduce((a, b) => a + b, 0);
    let allocated = 0;
    const updated: Array<{ id: string; audio_path: string; duration_ms: number; status: string }> = [];
    for (let i = 0; i < members.length; i++) {
      const durationMs =
        i === members.length - 1
          ? totalMs - allocated
          : Math.round((totalMs * words[i]) / totalWords);
      allocated += durationMs;
      const status = members[i].image_path ? "done" : "audio_done";
      const { error: updateError } = await supabase
        .from("scenes")
        .update({ audio_path: path, duration_ms: durationMs, status })
        .eq("id", members[i].id);
      if (updateError) return jsonError(updateError.message, 500);
      updated.push({ id: members[i].id, audio_path: path, duration_ms: durationMs, status });
    }

    const requested = updated.find((u) => u.id === sceneId)!;
    return NextResponse.json({
      ok: true,
      audio_path: requested.audio_path,
      duration_ms: requested.duration_ms,
      status: requested.status,
      scenes: updated,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
