import { NextRequest, NextResponse } from "next/server";
import { requireMember, jsonError, handleRouteError, geminiKey } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage, withRetry } from "@/lib/gemini";
import { characterSheetPrompt } from "@/lib/prompts";
import { getStyle } from "@/lib/styles";
import { extFor } from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 60;

// Draws one character's reference sheet. Every shot featuring that character
// is then drawn with this sheet attached, which keeps the character consistent.
export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireMember();
    if (error) return error;

    const { characterId } = await req.json();
    const { data: character } = await supabase
      .from("characters")
      .select("*, projects!inner(id, style, setting)")
      .eq("id", characterId)
      .single();
    if (!character) return jsonError("Character not found", 404);
    const project = (character as any).projects;

    const image = await withRetry(() =>
      generateImage(
        geminiKey(),
        characterSheetPrompt(getStyle(project.style).prompt, project.setting ?? "", character.name, character.look),
        "16:9"
      )
    );

    const path = `${user.id}/${project.id}/character_${String(character.idx).padStart(2, "0")}.${extFor(image.mimeType)}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("assets")
      .upload(path, image.bytes, { contentType: image.mimeType, upsert: true });
    if (uploadError) return jsonError(`Storage upload failed: ${uploadError.message}`, 500);

    const { error: updateError } = await supabase.from("characters").update({ sheet_path: path }).eq("id", characterId);
    if (updateError) return jsonError(updateError.message, 500);

    return NextResponse.json({ ok: true, sheet_path: path });
  } catch (e) {
    return handleRouteError(e);
  }
}
