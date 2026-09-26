import type { Config } from "tailwindcss";

// Three-color system on warm paper: forest (text, dark sections),
// terracotta (primary accent) and ochre (highlights), each with a tint.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F3EC",
        card: "#FFFDF9",
        line: "#E3DCCF",
        forest: {
          DEFAULT: "#1F3A2E",
          soft: "#4E6358",
          mute: "#7F8C84",
          tint: "#E6ECE7",
          deep: "#172C23",
        },
        clay: {
          DEFAULT: "#C4552D",
          dark: "#A94522",
          tint: "#F6E3DA",
        },
        ochre: {
          DEFAULT: "#D99A2B",
          tint: "#F8ECD3",
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
