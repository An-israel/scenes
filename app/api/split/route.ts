import { NextRequest, NextResponse } from "next/server";
import { requireMember, jsonError, handleRouteError } from "@/lib/api-helpers";
import { writeStoryboard } from "@/lib/storyboard";

export const runtime = "nodejs";
// Storyboarding a 30–60s story is quick, but leave headroom for one repair pass.
export const maxDuration = 120;

// Story → storyboard: characters + shots. Idempotent, so a resumed project
// gets its existing storyboard back instead of a new one.
export async function POST(req: NextRequest) {
  try {
    const { supabase, error } = await requireMember();
    if (error) return error;

    const { projectId } = await req.json();
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (!project) return jsonError("Project not found", 404);

    const { data: existing } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", projectId)
      .order("idx");
    if (existing && existing.length > 0) {
      const { data: characters } = await supabase
        .from("characters")
        .select("*")
        .eq("project_id", projectId)
        .order("idx");
      return NextResponse.json({ scenes: existing, characters: characters ?? [] });
    }

    await supabase.from("projects").update({ status: "splitting", error_message: null }).eq("id", projectId);

    const fail = async (message: string, status = 500) => {
      await supabase.from("projects").update({ status: "error", error_message: message }).eq("id", projectId);
      return jsonError(message, status);
    };

    let board;
    try {
      board = await writeStoryboard(project.script, process.env.GEMINI_API_KEY ?? null);
    } catch (e) {
      await supabase
        .from("projects")
        .update({ status: "error", error_message: e instanceof Error ? e.message : "Storyboard failed" })
        .eq("id", projectId);
      throw e;
    }

    const { data: characters, error: charError } = await supabase
      .from("characters")
      .insert(board.characters.map((c, i) => ({ project_id: projectId, idx: i + 1, name: c.name, look: c.look })))
      .select();
    if (charError) return fail(charError.message);

    const { data: scenes, error: sceneError } = await supabase
      .from("scenes")
      .insert(
        board.shots.map((s, i) => ({
          project_id: projectId,
          idx: i + 1,
          text: s.narration,
          image_description: s.visual,
          characters: s.characters,
          status: "pending",
        }))
      )
      .select();
    if (sceneError) return fail(sceneError.message);

    await supabase
      .from("projects")
      .update({
        status: "generating",
        setting: board.setting,
        ...(project.title === "Untitled" && board.title ? { title: board.title } : {}),
      })
      .eq("id", projectId);

    return NextResponse.json({
      scenes: (scenes ?? []).sort((a, b) => a.idx - b.idx),
      characters: (characters ?? []).sort((a, b) => a.idx - b.idx),
      title: project.title === "Untitled" && board.title ? board.title : project.title,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
