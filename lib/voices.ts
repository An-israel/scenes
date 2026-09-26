// Gemini TTS prebuilt voices with friendly labels. `style` is the delivery
// cue sent with every shot so separately voiced shots sound alike.

export interface VoiceOption {
  id: string; // raw Gemini prebuilt voice name
  label: string;
  hint: string;
  style: string;
}

export const VOICES: VoiceOption[] = [
  { id: "Charon", label: "Charon", hint: "Deep, assured narrator", style: "deep, warm, assured" },
  { id: "Sulafat", label: "Sulafat", hint: "Warm and engaging", style: "warm, engaging" },
  { id: "Iapetus", label: "Iapetus", hint: "Calm storyteller", style: "calm, steady" },
  { id: "Kore", label: "Kore", hint: "Friendly, bright", style: "friendly, bright" },
  { id: "Achird", label: "Achird", hint: "Gentle, youthful", style: "gentle, youthful" },
  { id: "Algenib", label: "Algenib", hint: "Gravelly, intense", style: "gravelly, intense" },
  { id: "Enceladus", label: "Enceladus", hint: "Soft, hushed", style: "soft, hushed, intimate" },
  { id: "Puck", label: "Puck", hint: "Upbeat, playful", style: "upbeat, playful" },
];

export function getVoice(id: string): VoiceOption {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}

export function isKnownVoice(id: unknown): boolean {
  return typeof id === "string" && VOICES.some((v) => v.id === id);
}

export const PREVIEW_SENTENCE =
  "Once upon a time, in a village by the sea, a small girl found a door that wasn't there yesterday.";
