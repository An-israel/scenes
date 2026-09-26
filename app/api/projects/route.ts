import { NextRequest, NextResponse } from "next/server";
import { requireMember, jsonError, handleRouteError } from "@/lib/api-helpers";
import { isKnownVoice } from "@/lib/voices";
import { ART_STYLES } from "@/lib/styles";
import { MAX_STORY_WORDS, countWords } from "@/lib/story";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireMember();
    if (error) return error;

    const { title, script, voiceId, aspectRatio, style } = await req.json();

    if (typeof script !== "string" || countWords(script) < 10) {
      return jsonError("The story is too short — write at least a couple of sentences.", 400);
    }
    const words = countWords(script);
    if (words > MAX_STORY_WORDS) {
      return jsonError(`The story is ${words} words — keep it under ${MAX_STORY_WORDS} for a 60-second video.`, 400);
    }
    if (!isKnownVoice(voiceId)) return jsonError("Unknown voice.", 400);

    const { data, error: dbError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title: typeof title === "string" && title.trim() ? title.trim() : "Untitled",
        script: script.trim(),
        voice_id: voiceId,
        aspect_ratio: aspectRatio === "16:9" ? "16:9" : "9:16",
        style: ART_STYLES.some((s) => s.id === style) ? style : ART_STYLES[0].id,
        status: "draft",
      })
      .select()
      .single();
    if (dbError) {
      if (/style|setting|aspect_ratio/.test(dbError.message)) {
        return jsonError("Database is missing new columns — run the latest migration in supabase/migrations.", 500);
      }
      return jsonError(dbError.message, 500);
    }

    return NextResponse.json({ project: data });
  } catch (e) {
    return handleRouteError(e);
  }
}
