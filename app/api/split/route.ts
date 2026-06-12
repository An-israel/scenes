import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  jsonError,
  handleRouteError,
  getUserKeys,
  NO_KEY_MESSAGE,
} from "@/lib/api-helpers";
import { generateJson, withRetry } from "@/lib/gemini";
import { openaiGenerateJson } from "@/lib/openai";
import { sceneSplitPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SplitScene {
  index: number;
  text: string;
  image_description: string;
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await requireUser();
    if (error) return error;

    const { projectId } = await req.json();
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (!project) return jsonError("Project not found", 404);

    // Idempotent: if scenes already exist, return them (resume support).
    const { data: existing } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", projectId)
      .order("idx");
    if (existing && existing.length > 0) {
      return NextResponse.json({ scenes: existing });
    }

    // Splitting prefers the free Gemini key; falls back to OpenAI.
    const keys = await getUserKeys(user.id);
    const generate = keys.gemini
      ? (p: string) => generateJson(keys.gemini!, p)
      : keys.openai
        ? (p: string) => openaiGenerateJson(keys.openai!, p)
        : null;
    if (!generate) return jsonError(NO_KEY_MESSAGE, 400);

    await supabase.from("projects").update({ status: "splitting", error_message: null }).eq("id", projectId);

    let scenes: SplitScene[];
    try {
      scenes = await splitWithRetry(generate, project.script);
    } catch (e) {
      await supabase
        .from("projects")
        .update({ status: "error", error_message: e instanceof Error ? e.message : "Split failed" })
        .eq("id", projectId);
      throw e;
    }

    // Group beats into ~22s audio chunks: one TTS call voices a whole chunk,
    // then its duration is split across the beats proportionally.
    const CHUNK_TARGET_WORDS = 55;
    const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
    let chunkIdx = 1;
    let chunkWords = 0;
    const rows = scenes.map((s, i) => {
      const w = countWords(s.text);
      if (chunkWords > 0 && chunkWords + w > CHUNK_TARGET_WORDS) {
        chunkIdx++;
        chunkWords = 0;
      }
      chunkWords += w;
      return {
        project_id: projectId,
        idx: i + 1,
        text: s.text,
        image_description: s.image_description,
        status: "pending",
        chunk_idx: chunkIdx,
      };
    });
    let { data: inserted, error: insertError } = await supabase.from("scenes").insert(rows).select();
    if (insertError && /chunk_idx/.test(insertError.message)) {
      // Migration 0004 not run yet — fall back to unchunked (per-beat audio).
      ({ data: inserted, error: insertError } = await supabase
        .from("scenes")
        .insert(rows.map(({ chunk_idx: _omit, ...r }) => r))
        .select());
    }
    if (insertError) return jsonError(insertError.message, 500);

    await supabase.from("projects").update({ status: "generating" }).eq("id", projectId);

    return NextResponse.json({
      scenes: (inserted ?? []).sort((a, b) => a.idx - b.idx),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

async function splitWithRetry(
  generate: (prompt: string) => Promise<string>,
  script: string
): Promise<SplitScene[]> {
  const prompt = sceneSplitPrompt(script);
  let raw = await withRetry(() => generate(prompt));
  let result = parseScenes(raw, script);
  if (result.ok) return result.scenes;
  const firstProblem = result.problem;

  // One repair pass: tell the model exactly what was wrong with its JSON.
  raw = await withRetry(() =>
    generate(
      `${prompt}\n\nYour previous answer was invalid: ${firstProblem}\nReturn corrected STRICT JSON only.`
    )
  );
  result = parseScenes(raw, script);
  if (result.ok) return result.scenes;
  throw new Error(`Scene split failed: ${result.problem}`);
}

type ParseResult = { ok: true; scenes: SplitScene[] } | { ok: false; problem: string };

function parseScenes(raw: string, script: string): ParseResult {
  // Strip code fences if the model added them despite responseMimeType.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, problem: "response was not valid JSON" };
  }
  if (!Array.isArray(parsed?.scenes) || parsed.scenes.length === 0) {
    return { ok: false, problem: "missing non-empty scenes array" };
  }
  for (const s of parsed.scenes) {
    if (typeof s?.text !== "string" || !s.text.trim()) {
      return { ok: false, problem: "a scene is missing its text" };
    }
    if (typeof s?.image_description !== "string" || !s.image_description.trim()) {
      return { ok: false, problem: "a scene is missing its image_description" };
    }
  }
  // Coverage check: joined scene words should reconstruct the script's words.
  const normalize = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const joined = normalize(parsed.scenes.map((s: any) => s.text).join(" "));
  const original = normalize(script);
  const jw = joined.split(" ").length;
  const ow = original.split(" ").length;
  if (joined !== original && Math.abs(jw - ow) / ow > 0.05) {
    return {
      ok: false,
      problem: `scene texts do not reconstruct the script (script has ${ow} words, your scenes total ${jw}). Cover every word, rewrite nothing.`,
    };
  }
  return {
    ok: true,
    scenes: parsed.scenes.map((s: any, i: number) => ({
      index: i + 1,
      text: s.text.trim(),
      image_description: s.image_description.trim(),
    })),
  };
}
