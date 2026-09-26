import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Rename a project. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, error } = await requireUser();
    if (error) return error;

    const { title } = await req.json();
    if (typeof title !== "string" || !title.trim()) return jsonError("Title can't be empty.", 400);

    const { data, error: dbError } = await supabase
      .from("projects")
      .update({ title: title.trim().slice(0, 120), updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select("id, title")
      .single();
    if (dbError || !data) return jsonError(dbError?.message ?? "Project not found", dbError ? 500 : 404);
    return NextResponse.json({ project: data });
  } catch (e) {
    return handleRouteError(e);
  }
}

/** Delete a project, its shots and characters, and every file it stored. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase, error } = await requireUser();
    if (error) return error;

    const { data: project } = await supabase.from("projects").select("id").eq("id", params.id).single();
    if (!project) return jsonError("Project not found", 404);

    const admin = createAdminClient();
    const folder = `${user.id}/${params.id}`;
    const { data: files } = await admin.storage.from("assets").list(folder, { limit: 1000 });
    if (files && files.length > 0) {
      const { error: removeError } = await admin.storage
        .from("assets")
        .remove(files.map((f) => `${folder}/${f.name}`));
      if (removeError) return jsonError(`Could not delete files: ${removeError.message}`, 500);
    }

    const { error: dbError } = await supabase.from("projects").delete().eq("id", params.id);
    if (dbError) return jsonError(dbError.message, 500);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
