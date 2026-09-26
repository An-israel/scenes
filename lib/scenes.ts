import type { SupabaseClient } from "@supabase/supabase-js";
import type { SceneStatus } from "@/lib/types";

/** Recompute a scene's status from what's actually stored. Audio and image
 *  are generated in parallel, so neither route can trust its own snapshot. */
export async function markDoneIfComplete(supabase: SupabaseClient, sceneId: string): Promise<SceneStatus> {
  const { data } = await supabase.from("scenes").select("audio_path, image_path").eq("id", sceneId).single();
  const status: SceneStatus =
    data?.audio_path && data?.image_path ? "done" : data?.audio_path ? "audio_done" : data?.image_path ? "image_done" : "pending";
  await supabase.from("scenes").update({ status }).eq("id", sceneId);
  return status;
}
