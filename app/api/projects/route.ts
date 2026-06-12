import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";
import { isKnownVoice } from "@/lib/voices";

export const runtime = "nodejs";

const MAX_WORDS = 2000;

export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireUser();
    if (error) return error;

    const { title, script, voiceId, aspectRatio } = await req.json();

    if (typeof script !== "string" || script.trim().length < 10) {
      return jsonError("Script is too short.", 400);
    }
    const words = script.trim().split(/\s+/).length;
    if (words > MAX_WORDS) {
      return jsonError(`Script is ${words} words — keep it under ${MAX_WORDS} (~10 minutes).`, 400);
    }
    if (!isKnownVoice(voiceId)) {
      return jsonError("Unknown voice.", 400);
    }
    const aspect = aspectRatio === "9:16" ? "9:16" : "16:9";

    const row = {
      user_id: user.id,
      title: typeof title === "string" && title.trim() ? title.trim() : "Untitled",
      script: script.trim(),
      voice_id: voiceId,
      status: "draft",
    };

    let { data, error: dbError } = await supabase
      .from("projects")
      .insert({ ...row, aspect_ratio: aspect })
      .select()
      .single();
    // Graceful degrade if migration 0002 hasn't been run yet.
    if (dbError && /aspect_ratio/.test(dbError.message)) {
      ({ data, error: dbError } = await supabase.from("projects").insert(row).select().single());
    }
    if (dbError) return jsonError(dbError.message, 500);

    return NextResponse.json({ project: data });
  } catch (e) {
    return handleRouteError(e);
  }
}
