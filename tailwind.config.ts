import type { Config } from "tailwindcss";

// Three-color system on warm paper: forest (text, dark sections),
// terracotta (primary accent) and ochre (highlights), each with a tint.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Colors come from CSS variables (globals.css) so the Color and B&W
      // themes can swap them. Stored as "R G B" to keep opacity modifiers.
      colors: {
        paper: v("paper"),
        card: v("card"),
        line: v("line"),
        forest: {
          DEFAULT: v("forest"),
          soft: v("forest-soft"),
          mute: v("forest-mute"),
          tint: v("forest-tint"),
          deep: v("forest-deep"),
        },
        clay: {
          DEFAULT: v("clay"),
          dark: v("clay-dark"),
          tint: v("clay-tint"),
        },
        ochre: {
          DEFAULT: v("ochre"),
          tint: v("ochre-tint"),
        },
      },
      fontFamily: {
        sans: ['"Inter Tight Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        label: "0.22em",
        display: "-0.045em",
      },
      maxWidth: {
        page: "1180px",
      },
    },
  },
  plugins: [],
};

export default config;
