// Story length rules shared by the form and the API. Narration runs at
// roughly 2.5 words per second, so 75–150 words ≈ 30–60 seconds.

export const MAX_STORY_WORDS = 170;
export const WORDS_PER_SECOND = 2.5;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function estimateSeconds(words: number): number {
  return Math.round(words / WORDS_PER_SECOND);
}
