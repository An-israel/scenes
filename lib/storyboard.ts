// Story → storyboard (title, world, characters, shots). Claude writes it when
// ANTHROPIC_API_KEY is set; otherwise Gemini does. Either way the result is
// validated here: every shot is well formed and the narrations reproduce the
// story's words, so the voiceover tells the whole story.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { generateJson, withRetry } from "@/lib/gemini";
import { STORYBOARD_INSTRUCTIONS, storyboardPrompt } from "@/lib/prompts";

const StoryboardSchema = z.object({
  title: z.string(),
  setting: z.string(),
  characters: z.array(z.object({ name: z.string(), look: z.string() })),
  shots: z.array(
    z.object({
      narration: z.string(),
      visual: z.string(),
      characters: z.array(z.string()),
    })
  ),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";

export async function writeStoryboard(story: string, geminiKey: string | null): Promise<Storyboard> {
  const write = process.env.ANTHROPIC_API_KEY
    ? (repair?: string) => claudeStoryboard(story, repair)
    : geminiKey
      ? (repair?: string) => geminiStoryboard(story, geminiKey, repair)
      : null;
  if (!write) throw new Error("No storyboard model configured (set ANTHROPIC_API_KEY or GEMINI_API_KEY).");

  let board = await write();
  let problem = checkStoryboard(board, story);
  if (!problem) return tidy(board);

  // One repair pass that names exactly what was wrong.
  board = await write(problem);
  problem = checkStoryboard(board, story);
  if (!problem) return tidy(board);
  throw new Error(`Storyboard failed: ${problem}`);
}

async function claudeStoryboard(story: string, repair?: string): Promise<Storyboard> {
  const client = new Anthropic();
  const params = {
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" as const },
    output_config: {
      effort: "medium" as const,
      format: zodOutputFormat(StoryboardSchema),
    },
    system: STORYBOARD_INSTRUCTIONS,
    messages: [
      {
        role: "user" as const,
        content: repair
          ? `STORY:\n${story}\n\nA previous storyboard for this story was rejected: ${repair}\nWrite a corrected storyboard.`
          : `STORY:\n${story}`,
      },
    ],
  };
  // Server-side refusal fallback: if Claude's safety classifiers decline,
  // the API re-runs the request on Anthropic's recommended fallback model.
  // `fallbacks` isn't in this SDK version's types yet, so it rides along
  // on the request body with its beta header.
  const response = await client.messages.parse(
    { ...params, fallbacks: "default" } as typeof params,
    { headers: { "anthropic-beta": "server-side-fallback-2026-07-01" } }
  );
  if (response.stop_reason === "refusal") {
    throw new Error("The storyboard model declined this story. Try rewording it.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("The storyboard was cut off. Try a shorter story.");
  }
  if (!response.parsed_output) throw new Error("The storyboard model returned an unreadable answer.");
  return response.parsed_output;
}

async function geminiStoryboard(story: string, apiKey: string, repair?: string): Promise<Storyboard> {
  const prompt = repair
    ? `${storyboardPrompt(story)}\n\nYour previous answer was rejected: ${repair}\nReturn corrected STRICT JSON only.`
    : storyboardPrompt(story);
  const raw = await withRetry(() => generateJson(apiKey, prompt));
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return { title: "", setting: "", characters: [], shots: [] };
  }
  const parsed = StoryboardSchema.safeParse(json);
  return parsed.success ? parsed.data : { title: "", setting: "", characters: [], shots: [] };
}

/** Returns a description of the first problem, or null when the storyboard is usable. */
function checkStoryboard(board: Storyboard, story: string): string | null {
  if (board.shots.length === 0) return "it had no shots (or was not valid JSON).";
  if (board.shots.some((s) => !s.narration.trim() || !s.visual.trim())) {
    return "a shot is missing its narration or visual.";
  }
  const normalize = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const joined = normalize(board.shots.map((s) => s.narration).join(" "));
  const original = normalize(story);
  const jw = joined.split(" ").length;
  const ow = original.split(" ").length;
  if (joined !== original && Math.abs(jw - ow) / ow > 0.05) {
    return `the shot narrations do not reproduce the story (story has ${ow} words, shots total ${jw}). Cover every word in order and rewrite nothing.`;
  }
  return null;
}

/** Trim strings, cap the cast at 4, and drop shot cast names that aren't defined characters. */
function tidy(board: Storyboard): Storyboard {
  const characters = board.characters
    .map((c) => ({ name: c.name.trim(), look: c.look.trim() }))
    .filter((c) => c.name && c.look)
    .slice(0, 4);
  const known = new Map(characters.map((c) => [c.name.toLowerCase(), c.name]));
  return {
    title: board.title.trim(),
    setting: board.setting.trim(),
    characters,
    shots: board.shots.map((s) => ({
      narration: s.narration.trim(),
      visual: s.visual.trim(),
      characters: Array.from(
        new Set(s.characters.map((n) => known.get(n.trim().toLowerCase())).filter((n): n is string => !!n))
      ),
    })),
  };
}
