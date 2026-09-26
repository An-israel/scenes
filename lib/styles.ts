// Art style presets. The chosen style is locked per project and repeated in
// every image prompt (character sheets and shots) so the whole story matches.

export interface ArtStyle {
  id: string;
  label: string;
  hint: string;
  prompt: string;
}

export const ART_STYLES: ArtStyle[] = [
  {
    id: "storybook",
    label: "Storybook",
    hint: "Soft painted picture-book look",
    prompt:
      "Hand-painted children's storybook illustration. Soft gouache and watercolor texture, warm natural light, gentle color palette, clean readable shapes, expressive faces.",
  },
  {
    id: "animated-3d",
    label: "3D animated",
    hint: "Feature-film CG look",
    prompt:
      "Stylized 3D animated feature-film look. Appealing rounded character designs, soft global illumination, cinematic depth of field, rich but balanced colors, subtle subsurface skin shading.",
  },
  {
    id: "anime",
    label: "Anime",
    hint: "Clean cel-shaded linework",
    prompt:
      "Japanese anime-inspired illustration. Clean confident line art, cel shading with two tones, detailed painted backgrounds, expressive eyes, cinematic framing.",
  },
  {
    id: "flat",
    label: "Flat graphic",
    hint: "Bold shapes, minimal detail",
    prompt:
      "Flat vector-style editorial illustration. Bold simple shapes, limited harmonious palette, no gradients, crisp edges, strong silhouettes, minimal texture.",
  },
];

export function getStyle(id: string | null | undefined): ArtStyle {
  return ART_STYLES.find((s) => s.id === id) ?? ART_STYLES[0];
}
