import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CharacterAsset, SceneAssetUrls } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SIGN_TTL_SECONDS = 60 * 60; // the page re-fetches well before this expires

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, error } = await requireUser();
    if (error) return error;

    const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
    if (!project) return jsonError("Project not found", 404);

    const [{ data: scenes }, { data: characters }] = await Promise.all([
      supabase.from("scenes").select("*").eq("project_id", params.id).order("idx"),
      supabase.from("characters").select("*").eq("project_id", params.id).order("idx"),
    ]);

    const paths = [
      ...(scenes ?? []).flatMap((s) => [s.audio_path, s.image_path]),
      ...(characters ?? []).map((c) => c.sheet_path),
      project.zip_path,
    ].filter((p): p is string => !!p);

    const admin = createAdminClient();
    const urlByPath = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed, error: signError } = await admin.storage
        .from("assets")
        .createSignedUrls(paths, SIGN_TTL_SECONDS);
      if (signError) return jsonError(signError.message, 500);
      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
      }
    }
    const url = (p: string | null) => (p ? (urlByPath.get(p) ?? null) : null);

    const assets: SceneAssetUrls[] = (scenes ?? []).map((s) => ({
      id: s.id,
      idx: s.idx,
      start_ms: s.start_ms,
      duration_ms: s.duration_ms,
      text: s.text,
      audio_url: url(s.audio_path),
      image_url: url(s.image_path),
    }));
    const characterAssets: CharacterAsset[] = (characters ?? []).map((c) => ({
      id: c.id,
      idx: c.idx,
      name: c.name,
      look: c.look,
      sheet_url: url(c.sheet_path),
    }));

    return NextResponse.json({
      assets,
      characters: characterAssets,
      zip_url: url(project.zip_path),
      project,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
