// The two locked prompts from the product spec. Do not tweak casually —
// every project's visual consistency depends on the style prompt.

export function sceneSplitPrompt(script: string): string {
  return `You are a storyboard director for a fast-cut 2D animated explainer video.
Split the SCRIPT below into rapid visual BEATS.

Rules:
- A beat = one tiny visual moment: MAXIMUM 8 words (≈3 seconds of speech).
  Most beats should be 4-8 words. The video cuts to a new image every beat,
  so short beats keep viewer attention.
- Break sentences at natural phrase boundaries — commas, "and"/"but"/"so",
  verb changes. Never break mid-phrase in a way that reads awkwardly.
- Cover the ENTIRE script. Do not skip, merge away, or rewrite any words —
  beat texts joined together must equal the original script.
- For each beat, write IMAGE_DESCRIPTION: a concrete, drawable visual —
  WHO is in frame (use the recurring character when the narration speaks
  about a person), WHAT they're doing, WHERE, plus any key object, symbol,
  text label, or arrow. Describe a single static frame, not motion.
- Keep descriptions literal and simple — flat 2D explainer cartoon logic
  (e.g. "stick-figure man kneeling by a campfire roasting meat on a stick,
  savanna with flat-topped trees behind, worried expression").

Return STRICT JSON only:
{"scenes":[{"index":1,"text":"...","image_description":"..."}]}

SCRIPT:
${script}`;
}

export function imagePrompt(imageDescription: string, aspectRatio: "16:9" | "9:16" = "16:9"): string {
  const frame =
    aspectRatio === "9:16"
      ? "9:16 vertical portrait frame (TikTok/Shorts)"
      : "16:9";
  return `2D hand-drawn explainer cartoon, minimalist stick-figure style. Characters:
simple stick bodies with bold black ink outlines, round white heads, large
simple dot eyes, expressive shaggy scribbled hair, minimal facial features.
Flat solid colors, no gradients, no shading, no texture. Thick uniform
black outlines on every element. Simple flat background in warm muted
tones (sandy beige ground, burnt-orange or off-white sky), minimal props
drawn in the same naive doodle style. Generous empty space, composition
readable in 1 second. Educational explainer animation frame,
${frame}, high resolution. NO photorealism, NO 3D, NO gradients, NO small
unreadable text, NO watermark.

SCENE TO DRAW: ${imageDescription}`;
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

export function ttsPrompt(voiceStyle: string, sceneText: string): string {
  return `Read the following narration in a ${voiceStyle} tone. Natural pace, clear diction. Script begins now: "${sceneText}"`;
}
