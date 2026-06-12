import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  jsonError,
  handleRouteError,
  getUserKeys,
  NO_KEY_MESSAGE,
} from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRetry } from "@/lib/gemini";
import { openaiImage } from "@/lib/openai";
import { pollinationsImage } from "@/lib/pollinations";
import { generateSvgImage } from "@/lib/svg-image";
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

    const keys = await getUserKeys(user.id);

    // Project orientation; default 16:9 for rows predating migration 0002.
    let aspect: "16:9" | "9:16" = "16:9";
    const { data: proj } = await supabase
      .from("projects")
      .select("aspect_ratio")
      .eq("id", scene.project_id)
      .maybeSingle();
    if (proj && (proj as any).aspect_ratio === "9:16") aspect = "9:16";

    // OpenAI when its key is saved. Otherwise: try the free keyless Pollinations
    // service, and if it refuses (rate limits / paywall changes), fall back to
    // flat SVG art drawn by the free Gemini text model — always available.
    const prompt = imagePrompt(scene.image_description, aspect);
    let bytes: Buffer;
    let mimeType: string;
    if (keys.openai) {
      bytes = await withRetry(() => openaiImage(keys.openai!, prompt, aspect));
      mimeType = "image/png";
    } else {
      try {
        ({ bytes, mimeType } = await pollinationsImage(prompt, aspect));
      } catch (e) {
        if (!keys.gemini) throw e;
        bytes = await generateSvgImage(keys.gemini, scene.image_description, aspect);
        mimeType = "image/svg+xml";
      }
    }

    const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("svg") ? "svg" : "png";
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
