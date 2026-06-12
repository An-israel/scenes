// Free image fallback: the (free) Gemini text model writes a flat vector
// illustration as SVG. Browsers render SVG natively in <img>, and the ZIP
// builder rasterizes to PNG client-side — no server image libraries needed.

import { generateText, withRetry, GeminiError } from "./gemini";

function svgPrompt(description: string, w: number, h: number): string {
  return `You are a vector illustrator. Draw ONE flat, minimalist cartoon illustration as SVG code.

SCENE TO ILLUSTRATE:
${description}

STRICT RULES:
- Respond with ONLY the SVG code. No markdown, no backticks, no explanation.
- Root element: <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
- First element: a full-canvas background <rect> filled #F7F1E2 (warm cream).
- Style: flat 2D, bold and simple. Stick-figure people: circle head, thick rounded-line body/limbs, stroke #2A2A2A, stroke-width 10, stroke-linecap="round", no faces beyond simple dot eyes.
- Palette only: #F7F1E2 background, #2A2A2A ink, #D9A441 gold, #C96F4A coral, #7A8B7F sage. Solid fills.
- Compose 2-5 large simple objects, centered, generous margins. Big shapes, not detail.
- If the scene calls for a text label, ONE short uppercase label (1-3 words) using <text> with font-family="Arial, Helvetica, sans-serif" font-weight="bold", fill #2A2A2A.
- Allowed elements ONLY: svg, rect, circle, ellipse, line, polyline, polygon, path, text, g.
- No gradients, filters, masks, images, scripts, animations, or external references.`;
}

/** Extract + sanitize the SVG, ensuring it's self-contained and sized. */
function extractSvg(raw: string, w: number, h: number): string | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return null;
  let svg = match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(image|foreignObject)[\s\S]*?(\/>|<\/\1>)/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "");
  // <img> needs explicit dimensions on the root element.
  const root = svg.match(/<svg[^>]*>/i)![0];
  let fixedRoot = root;
  if (!/\sxmlns=/.test(fixedRoot)) {
    fixedRoot = fixedRoot.replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg"`);
  }
  if (!/\swidth=/.test(fixedRoot)) {
    fixedRoot = fixedRoot.replace("<svg", `<svg width="${w}" height="${h}"`);
  }
  return svg.replace(root, fixedRoot);
}

export async function generateSvgImage(
  apiKey: string,
  description: string,
  aspectRatio: "16:9" | "9:16"
): Promise<Buffer> {
  const [w, h] = aspectRatio === "9:16" ? [768, 1344] : [1344, 768];
  const prompt = svgPrompt(description, w, h);

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await withRetry(() =>
      generateText(
        apiKey,
        attempt === 0
          ? prompt
          : `${prompt}\n\nYour previous attempt was not valid SVG. Output ONLY a complete <svg>...</svg> document.`
      )
    );
    const svg = extractSvg(raw, w, h);
    if (svg) return Buffer.from(svg, "utf-8");
  }
  throw new GeminiError("Scene illustration failed — try regenerating this scene.", 502);
}
