import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cumulative start times from each shot's real audio duration.
export async function POST(req: NextRequest) {
  try {
    const { supabase, error } = await requireUser();
    if (error) return error;

    const { projectId } = await req.json();
    const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).single();
    if (!project) return jsonError("Project not found", 404);

    const { data: scenes } = await supabase
      .from("scenes")
      .select("id, audio_path, image_path, duration_ms")
      .eq("project_id", projectId)
      .order("idx");
    if (!scenes || scenes.length === 0) return jsonError("No shots to finalize", 400);

    const incomplete = scenes.filter((s) => !s.audio_path || !s.image_path || s.duration_ms == null);
    if (incomplete.length > 0) {
      return jsonError(`${incomplete.length} shot(s) still missing audio or image — finish generating first.`, 400);
    }

    let cursor = 0;
    const updates = scenes.map((s) => {
      const start = cursor;
      cursor += s.duration_ms!;
      return supabase.from("scenes").update({ start_ms: start, status: "done" }).eq("id", s.id);
    });
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) return jsonError(failed.error.message, 500);

    const { error: projectError } = await supabase
      .from("projects")
      .update({ status: "done", total_duration_ms: cursor, error_message: null, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (projectError) return jsonError(projectError.message, 500);

    return NextResponse.json({ ok: true, total_duration_ms: cursor });
  } catch (e) {
    return handleRouteError(e);
  }
}
