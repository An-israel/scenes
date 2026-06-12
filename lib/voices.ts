// Curated Gemini TTS prebuilt voices with friendly labels.
// `style` feeds the per-project narration preamble so chunks sound uniform.

export interface VoiceOption {
  id: string; // raw Gemini prebuilt voice name
  label: string;
  style: string;
}

export const VOICES: VoiceOption[] = [
  { id: "Charon", label: "Charon — Deep Authority", style: "deep, authoritative documentary" },
  { id: "Iapetus", label: "Iapetus — Calm Narrator", style: "calm, steady storyteller" },
  { id: "Algenib", label: "Algenib — Gravel", style: "gravelly, intense" },
  { id: "Kore", label: "Kore — Warm Female", style: "warm, friendly female" },
  { id: "Puck", label: "Puck — Upbeat", style: "upbeat, energetic" },
  { id: "Fenrir", label: "Fenrir — Excitable", style: "excitable, dramatic" },
  { id: "Enceladus", label: "Enceladus — Breathy", style: "soft, breathy, intimate" },
  { id: "Schedar", label: "Schedar — Even Keel", style: "even, measured explainer" },
  { id: "Sulafat", label: "Sulafat — Warm Glow", style: "warm, engaging" },
  { id: "Zephyr", label: "Zephyr — Bright", style: "bright, clear female" },
];

export function getVoice(id: string): VoiceOption {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}

export const PREVIEW_SENTENCE =
  "This is how your story will sound, scene by scene, from the very first frame.";
