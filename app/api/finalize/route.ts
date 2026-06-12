import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { supabase, error } = await requireUser();
    if (error) return error;

    const { projectId } = await req.json();
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();
    if (!project) return jsonError("Project not found", 404);

    const { data: scenes } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", projectId)
      .order("idx");
    if (!scenes || scenes.length === 0) return jsonError("No scenes to finalize", 400);

    const incomplete = scenes.filter((s) => !s.audio_path || !s.image_path || s.duration_ms == null);
    if (incomplete.length > 0) {
      return jsonError(
        `${incomplete.length} scene(s) still missing audio or image — finish generating first.`,
        400
      );
    }

    // Cumulative starts from real audio durations — never estimates.
    let cursor = 0;
    for (const s of scenes) {
      await supabase.from("scenes").update({ start_ms: cursor, status: "done" }).eq("id", s.id);
      cursor += s.duration_ms!;
    }

    await supabase
      .from("projects")
      .update({
        status: "done",
        total_duration_ms: cursor,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    return NextResponse.json({ ok: true, total_duration_ms: cursor });
  } catch (e) {
    return handleRouteError(e);
  }
}
