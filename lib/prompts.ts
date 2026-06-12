// The two locked prompts from the product spec. Do not tweak casually —
// every project's visual consistency depends on the style prompt.

export function sceneSplitPrompt(script: string): string {
  return `You are a storyboard director for a 2D animated explainer video.
Split the SCRIPT below into natural visual scenes.

Rules:
- A scene = one visual idea/beat. Usually 1–3 sentences. Never more than
  ~45 words per scene (≈15 seconds of speech).
- Break wherever the mental image changes (new action, new object, new
  metaphor, new location, comparison, list item).
- Cover the ENTIRE script. Do not skip, merge away, or rewrite any words —
  scene texts joined together must equal the original script.
- For each scene, write IMAGE_DESCRIPTION: a concrete, drawable visual —
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

export function imagePrompt(imageDescription: string): string {
  return `2D hand-drawn explainer cartoon, minimalist stick-figure style. Characters:
simple stick bodies with bold black ink outlines, round white heads, large
simple dot eyes, expressive shaggy scribbled hair, minimal facial features.
Flat solid colors, no gradients, no shading, no texture. Thick uniform
black outlines on every element. Simple flat background in warm muted
tones (sandy beige ground, burnt-orange or off-white sky), minimal props
drawn in the same naive doodle style. Generous empty space, composition
readable in 1 second. Educational YouTube explainer animation frame,
16:9, high resolution. NO photorealism, NO 3D, NO gradients, NO small
unreadable text, NO watermark.

SCENE TO DRAW: ${imageDescription}`;
}

export function ttsPrompt(voiceStyle: string, sceneText: string): string {
  return `Read the following narration in a ${voiceStyle} tone. Natural pace, clear diction. Script begins now: "${sceneText}"`;
}
