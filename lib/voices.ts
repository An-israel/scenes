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

// OpenAI gpt-4o-mini-tts prebuilt voices (used when the user has an OpenAI key).
export const OPENAI_VOICES: VoiceOption[] = [
  { id: "onyx", label: "Onyx — Deep Authority", style: "deep, authoritative documentary narrator" },
  { id: "echo", label: "Echo — Calm Narrator", style: "calm, steady storyteller" },
  { id: "fable", label: "Fable — Storyteller", style: "expressive, engaging storyteller" },
  { id: "ash", label: "Ash — Warm Male", style: "warm, grounded male" },
  { id: "alloy", label: "Alloy — Neutral", style: "clear, neutral" },
  { id: "ballad", label: "Ballad — Smooth", style: "smooth, melodic" },
  { id: "nova", label: "Nova — Warm Female", style: "warm, friendly female" },
  { id: "shimmer", label: "Shimmer — Bright Female", style: "bright, upbeat female" },
  { id: "coral", label: "Coral — Friendly Female", style: "friendly, conversational female" },
  { id: "sage", label: "Sage — Soft Calm", style: "soft, calm, soothing" },
];

export function isOpenAIVoice(id: string): boolean {
  return OPENAI_VOICES.some((v) => v.id === id);
}

/** Resolve a project's voice for OpenAI TTS, mapping legacy Gemini voices to a default. */
export function getOpenAIVoice(id: string): VoiceOption {
  return OPENAI_VOICES.find((v) => v.id === id) ?? OPENAI_VOICES[0];
}

// Deepgram Aura voices (used when a Deepgram key is saved and no OpenAI key).
export const DEEPGRAM_VOICES: VoiceOption[] = [
  { id: "aura-2-orion-en", label: "Orion — Deep Narrator", style: "deep, confident narrator" },
  { id: "aura-2-zeus-en", label: "Zeus — Authority", style: "deep, authoritative" },
  { id: "aura-2-arcas-en", label: "Arcas — Warm Male", style: "warm, natural male" },
  { id: "aura-2-apollo-en", label: "Apollo — Casual Male", style: "casual, conversational male" },
  { id: "aura-2-thalia-en", label: "Thalia — Clear Female", style: "clear, confident female" },
  { id: "aura-2-asteria-en", label: "Asteria — Bright Female", style: "bright, engaging female" },
  { id: "aura-2-luna-en", label: "Luna — Soft Female", style: "soft, soothing female" },
  { id: "aura-2-athena-en", label: "Athena — Calm Female", style: "calm, measured female" },
];

export function isDeepgramVoice(id: string): boolean {
  return id.startsWith("aura-");
}

/** Resolve a project's voice for Deepgram, mapping other providers' ids to a default. */
export function getDeepgramVoice(id: string): VoiceOption {
  return DEEPGRAM_VOICES.find((v) => v.id === id) ?? DEEPGRAM_VOICES[0];
}

export function isKnownVoice(id: string): boolean {
  return VOICES.some((v) => v.id === id) || isOpenAIVoice(id) || isDeepgramVoice(id);
}

export const PREVIEW_SENTENCE =
  "This is how your story will sound, scene by scene, from the very first frame.";
