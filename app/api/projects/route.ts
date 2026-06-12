import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";
import { VOICES } from "@/lib/voices";

export const runtime = "nodejs";

const MAX_WORDS = 2000;

export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireUser();
    if (error) return error;

    const { title, script, voiceId } = await req.json();

    if (typeof script !== "string" || script.trim().length < 10) {
      return jsonError("Script is too short.", 400);
    }
    const words = script.trim().split(/\s+/).length;
    if (words > MAX_WORDS) {
      return jsonError(`Script is ${words} words — keep it under ${MAX_WORDS} (~10 minutes).`, 400);
    }
    if (!VOICES.some((v) => v.id === voiceId)) {
      return jsonError("Unknown voice.", 400);
    }

    const { data, error: dbError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title: typeof title === "string" && title.trim() ? title.trim() : "Untitled",
        script: script.trim(),
        voice_id: voiceId,
        status: "draft",
      })
      .select()
      .single();
    if (dbError) return jsonError(dbError.message, 500);

    return NextResponse.json({ project: data });
  } catch (e) {
    return handleRouteError(e);
  }
}
