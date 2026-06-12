export type ProjectStatus = "draft" | "splitting" | "generating" | "done" | "error";
export type SceneStatus = "pending" | "audio_done" | "image_done" | "done" | "error";
export type AspectRatio = "16:9" | "9:16";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  script: string;
  voice_id: string;
  aspect_ratio?: AspectRatio; // missing on rows created before migration 0002 → treat as 16:9
  status: ProjectStatus;
  total_duration_ms: number | null;
  zip_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  idx: number;
  text: string;
  image_description: string;
  audio_path: string | null;
  image_path: string | null;
  duration_ms: number | null;
  start_ms: number | null;
  status: SceneStatus;
  chunk_idx?: number | null;
}

export interface SceneAssetUrls {
  id: string;
  idx: number;
  start_ms: number | null;
  duration_ms: number | null;
  text: string;
  audio_url: string | null;
  image_url: string | null;
}
