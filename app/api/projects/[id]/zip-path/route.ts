import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";

export const runtime = "nodejs";

// Client uploads final.zip straight to Storage (too big to proxy through a
// serverless route), then records the path here.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase, error } = await requireUser();
    if (error) return error;

    const { zipPath } = await req.json();
    if (typeof zipPath !== "string" || !zipPath.startsWith(`${user.id}/${params.id}/`)) {
      return jsonError("Invalid zip path", 400);
    }

    const { error: dbError } = await supabase
      .from("projects")
      .update({ zip_path: zipPath, updated_at: new Date().toISOString() })
      .eq("id", params.id);
    if (dbError) return jsonError(dbError.message, 500);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
