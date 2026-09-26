import { NextRequest, NextResponse } from "next/server";
import { requireMember, jsonError, handleRouteError, geminiKey } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage, withRetry, type InlineImage } from "@/lib/gemini";
import { shotPrompt } from "@/lib/prompts";
import { getStyle } from "@/lib/styles";
import { extFor } from "@/lib/media";
import { markDoneIfComplete } from "@/lib/scenes";

export const runtime = "nodejs";
export const maxDuration = 60;

// Draws one shot, attaching the reference sheet of every character in it.
export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireMember();
    if (error) return error;

    const { sceneId } = await req.json();
    const { data: scene } = await supabase
      .from("scenes")
      .select("*, projects!inner(id, style, setting, aspect_ratio)")
      .eq("id", sceneId)
      .single();
    if (!scene) return jsonError("Scene not found", 404);
    const project = (scene as any).projects;
    const aspect: "16:9" | "9:16" = project.aspect_ratio === "9:16" ? "9:16" : "16:9";

    const castNames: string[] = scene.characters ?? [];
    const { data: characters } = castNames.length
      ? await supabase.from("characters").select("*").eq("project_id", scene.project_id).in("name", castNames)
      : { data: [] as any[] };
    const cast = (characters ?? []).sort((a, b) => a.idx - b.idx);

    const admin = createAdminClient();
    const references: InlineImage[] = [];
    for (const c of cast) {
      if (!c.sheet_path) continue;
      const { data: blob } = await admin.storage.from("assets").download(c.sheet_path);
      if (blob) references.push({ bytes: Buffer.from(await blob.arrayBuffer()), mimeType: blob.type || "image/png" });
    }

    const image = await withRetry(() =>
      generateImage(
        geminiKey(),
        shotPrompt(
          getStyle(project.style).prompt,
          project.setting ?? "",
          scene.image_description,
          cast.map((c) => ({ name: c.name, look: c.look })),
          aspect
        ),
        aspect,
        references
      )
    );

    const path = `${user.id}/${scene.project_id}/scene_${String(scene.idx).padStart(3, "0")}.${extFor(image.mimeType)}`;
    const { error: uploadError } = await admin.storage
      .from("assets")
      .upload(path, image.bytes, { contentType: image.mimeType, upsert: true });
    if (uploadError) return jsonError(`Storage upload failed: ${uploadError.message}`, 500);

    const { error: updateError } = await supabase.from("scenes").update({ image_path: path }).eq("id", sceneId);
    if (updateError) return jsonError(updateError.message, 500);
    const status = await markDoneIfComplete(supabase, sceneId);

    return NextResponse.json({ ok: true, image_path: path, status });
  } catch (e) {
    return handleRouteError(e);
  }
}
