// Prompts for the story pipeline. The storyboard prompt is shared by the
// Claude and Gemini paths so both produce the same shape.

export const STORYBOARD_INSTRUCTIONS = `You are the director of a short animated story video (30–60 seconds) for TikTok, Reels and Shorts.
Turn the STORY into a storyboard of quick SHOTS that will each show one still image while the narrator reads that shot's words.

Rules for shots:
- Each shot's narration is one natural phrase of 7–13 words (about 3–5 seconds read aloud).
- Break at natural phrase boundaries. Never split in a way that reads awkwardly.
- Cover the ENTIRE story in order. Do not skip, add, merge away or rewrite words: the shot narrations joined together must equal the story.
- For each shot write "visual": one concrete, drawable frame. Say who is in frame (by character name), what they are doing, where, the camera framing (wide, medium, close-up) and the mood. Describe a single moment, not motion. Vary framing across shots so the video feels edited.
- "characters" lists the names of the recurring characters visible in that shot (empty if none).

Rules for characters:
- List every recurring character (people, animals, creatures) who appears in more than one shot, at most 4.
- "look" is a precise, fixed visual description reused for every image: age, build, skin/fur, hair, face, and one specific outfit with colors. Be concrete (e.g. "8-year-old girl, light brown skin, curly black hair in two puffs, round glasses, yellow raincoat, red rubber boots"). No personality words.
- Use the character's name from the story, or a short descriptive name if unnamed.

"setting" is one sentence fixing the world, era and color mood so every shot matches.
"title" is a short title for the video.`;

export function storyboardPrompt(story: string): string {
  return `${STORYBOARD_INSTRUCTIONS}

Return STRICT JSON only:
{"title":"...","setting":"...","characters":[{"name":"...","look":"..."}],"shots":[{"narration":"...","visual":"...","characters":["..."]}]}

STORY:
${story}`;
}

export function characterSheetPrompt(stylePrompt: string, setting: string, name: string, look: string): string {
  return `Character reference sheet for an animated short.

STYLE: ${stylePrompt}
WORLD: ${setting}

CHARACTER: ${name} — ${look}

Show the same character three times side by side on a plain light neutral background: full body front view, three-quarter view, and a close-up of the face with a neutral expression. Even lighting, no scenery, no text, no labels, no watermark. The design must be clear enough to redraw exactly in later scenes.`;
}

export function shotPrompt(
  stylePrompt: string,
  setting: string,
  visual: string,
  cast: Array<{ name: string; look: string }>,
  aspectRatio: "16:9" | "9:16"
): string {
  const castLines = cast.length
    ? `CHARACTERS IN THIS SHOT (the attached reference images show each one; keep face, hair, body and outfit IDENTICAL to the references):\n${cast
        .map((c) => `- ${c.name}: ${c.look}`)
        .join("\n")}\n\n`
    : "";
  const frame = aspectRatio === "9:16" ? "vertical 9:16 frame" : "horizontal 16:9 frame";
  return `One frame from an animated short film, ${frame}.

STYLE: ${stylePrompt}
WORLD: ${setting}

${castLines}SHOT: ${visual}

Full-bleed illustration, cinematic composition, no text, no captions, no speech bubbles, no borders, no watermark.`;
}

/** Gemini TTS: a short style lead-in, then the words. Kept to Gemini's
 *  documented "Say …:" shape so the instruction itself isn't read aloud. */
export function ttsPrompt(voiceStyle: string, text: string): string {
  return `Say in a ${voiceStyle} storytelling voice: ${text}`;
}

export function clipFinderPrompt(count: number, minSec: number, maxSec: number): string {
  return `You are an elite short-form video editor who finds viral clips inside long YouTube videos for TikTok, Reels and Shorts.

Watch the video and select the ${count} MOST powerful, scroll-stopping moments to cut into standalone vertical clips.

What makes a great clip:
- It stands ALONE without the rest of the video. A stranger scrolling should get it instantly.
- It opens on a strong HOOK in the first 1-2 seconds — a bold claim, a question, a surprising statement, the start of a story, or an emotional spike.
- It pays off: a punchline, a revelation, a satisfying conclusion, a counterintuitive fact, or a quotable line.
- Prefer self-contained thoughts. Do NOT cut mid-sentence at the start or end — begin and end on natural speech boundaries.
- Each clip must be between ${minSec} and ${maxSec} seconds long.
- Spread clips across the WHOLE video (beginning, middle, end). Do not bunch them together or overlap them.
- Rank them strongest-first (clip 1 = the single best moment).

Use the video's REAL spoken content. Timestamps must be accurate to the actual video.

Return STRICT JSON only, no markdown:
{"clips":[{
  "start":"M:SS",
  "end":"M:SS",
  "start_seconds": <integer seconds from video start>,
  "end_seconds": <integer seconds from video start>,
  "title": "<scroll-stopping caption/title for the short, max ~70 chars>",
  "reason": "<one sentence: why this exact moment grabs and holds attention>",
  "transcript": "<the words actually spoken in this segment, verbatim>"
}]}

Give exactly ${count} clips if the video is long enough; fewer only if the video is too short.`;
}
