import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError, handleRouteError } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SceneAssetUrls } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SIGN_TTL_SECONDS = 60 * 60; // 1 hour — plenty for a client-side zip build

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, error } = await requireUser();
    if (error) return error;

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", params.id)
      .single();
    if (!project) return jsonError("Project not found", 404);

    const { data: scenes } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", params.id)
      .order("idx");

    const admin = createAdminClient();
    const paths = (scenes ?? [])
      .flatMap((s) => [s.audio_path, s.image_path])
      .filter((p): p is string => !!p);

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

    let zipUrl: string | null = null;
    if (project.zip_path) {
      const { data: z } = await admin.storage
        .from("assets")
        .createSignedUrl(project.zip_path, SIGN_TTL_SECONDS);
      zipUrl = z?.signedUrl ?? null;
    }

    const assets: SceneAssetUrls[] = (scenes ?? []).map((s) => ({
      id: s.id,
      idx: s.idx,
      start_ms: s.start_ms,
      duration_ms: s.duration_ms,
      text: s.text,
      audio_url: s.audio_path ? (urlByPath.get(s.audio_path) ?? null) : null,
      image_url: s.image_path ? (urlByPath.get(s.image_path) ?? null) : null,
    }));

    return NextResponse.json({ assets, zip_url: zipUrl, project });
  } catch (e) {
    return handleRouteError(e);
  }
}
