import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  jsonError,
  handleRouteError,
  getUserGeminiKey,
  NO_KEY_MESSAGE,
} from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage, withRetry } from "@/lib/gemini";
import { imagePrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireUser();
    if (error) return error;

    const { sceneId } = await req.json();

    const { data: scene } = await supabase
      .from("scenes")
      .select("*")
      .eq("id", sceneId)
      .single();
    if (!scene) return jsonError("Scene not found", 404);

    const apiKey = await getUserGeminiKey(user.id);
    if (!apiKey) return jsonError(NO_KEY_MESSAGE, 400);

    const { bytes, mimeType } = await withRetry(() =>
      generateImage(apiKey, imagePrompt(scene.image_description))
    );

    const ext = mimeType.includes("jpeg") ? "jpg" : "png";
    const path = `${user.id}/${scene.project_id}/scene_${String(scene.idx).padStart(3, "0")}.${ext}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("assets")
      .upload(path, bytes, { contentType: mimeType, upsert: true });
    if (uploadError) return jsonError(`Storage upload failed: ${uploadError.message}`, 500);

    const newStatus = scene.audio_path ? "done" : "image_done";
    const { error: updateError } = await supabase
      .from("scenes")
      .update({ image_path: path, status: newStatus })
      .eq("id", sceneId);
    if (updateError) return jsonError(updateError.message, 500);

    return NextResponse.json({ ok: true, image_path: path, status: newStatus });
  } catch (e) {
    return handleRouteError(e);
  }
}
