import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#1a1a2e",
        primary: "#6366f1",
        "primary-hover": "#818cf8",
        text: "#e2e8f0",
        "text-muted": "#94a3b8",
        border: "#2d2d44",
      },
    },
  },
  plugins: [],
};

export default config;
