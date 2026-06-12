import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0C",
        panel: "#141416",
        edge: "#26262A",
        gold: "#C9A84C",
        "gold-bright": "#E3C56B",
      },
    },
  },
  plugins: [],
};

export default config;
