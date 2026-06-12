// Free image fallback: the (free) Gemini text model writes a flat vector
// illustration as SVG, which we rasterize to PNG with sharp. Costs nothing,
// has no image-API quota, and matches the app's flat minimalist style.

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { generateText, withRetry, GeminiError } from "./gemini";

// Vercel lambdas ship no fonts; point fontconfig at our bundled DejaVu Sans
// Bold so <text> labels render. Must run before sharp's first rasterization.
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const fontDir = path.join(process.cwd(), "assets", "fonts");
  if (process.env.FONTCONFIG_FILE || !fs.existsSync(path.join(fontDir, "DejaVuSans-Bold.ttf"))) return;
  const cacheDir = "/tmp/fonts-cache";
  fs.mkdirSync(cacheDir, { recursive: true });
  const conf = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig><dir>${fontDir}</dir><cachedir>${cacheDir}</cachedir></fontconfig>`;
  fs.writeFileSync("/tmp/fonts.conf", conf);
  process.env.FONTCONFIG_FILE = "/tmp/fonts.conf";
}

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
- If the scene calls for a text label, ONE short uppercase label (1-3 words) using <text> with font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold", fill #2A2A2A.
- Allowed elements ONLY: svg, rect, circle, ellipse, line, polyline, polygon, path, text, g.
- No gradients, filters, masks, images, scripts, animations, or external references.`;
}

function extractSvg(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return null;
  return match[0]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(image|foreignObject)[\s\S]*?(\/>|<\/\1>)/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "");
}

export async function generateSvgImage(
  apiKey: string,
  description: string,
  aspectRatio: "16:9" | "9:16"
): Promise<Buffer> {
  const [w, h] = aspectRatio === "9:16" ? [768, 1344] : [1344, 768];
  ensureFonts();
  const prompt = svgPrompt(description, w, h);

  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await withRetry(() =>
      generateText(
        apiKey,
        attempt === 0 ? prompt : `${prompt}\n\nYour previous attempt failed: ${lastProblem}. Output valid SVG only.`
      )
    );
    const svg = extractSvg(raw);
    if (!svg) {
      lastProblem = "no <svg>...</svg> block found";
      continue;
    }
    try {
      return await sharp(Buffer.from(svg), { density: 96 })
        .resize(w, h, { fit: "fill" })
        .png()
        .toBuffer();
    } catch (e) {
      lastProblem = e instanceof Error ? e.message : "SVG could not be rendered";
    }
  }
  throw new GeminiError(`Scene illustration failed (${lastProblem}) — try regenerating.`, 502);
}
