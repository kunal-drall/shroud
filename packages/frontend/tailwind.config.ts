import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      colors: {
        bg:        "hsl(var(--bg))",
        surface:   "hsl(var(--surface))",
        border:    "hsl(var(--border))",
        muted:     "hsl(var(--muted))",
        text:      "hsl(var(--text))",
        accent:    "hsl(var(--accent))",
        warn:      "hsl(var(--warn))",
        danger:    "hsl(var(--danger))",
        highlight: "hsl(var(--highlight))",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "progress-fill": {
          "0%":   { width: "0%" },
          "100%": { width: "100%" },
        },
        "pulse-accent": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
      },
      animation: {
        "fade-up":     "fade-up 0.4s ease-out forwards",
        "fade-up-d1":  "fade-up 0.4s 80ms ease-out forwards",
        "fade-up-d2":  "fade-up 0.4s 160ms ease-out forwards",
        "fade-up-d3":  "fade-up 0.4s 240ms ease-out forwards",
        "fade-up-d4":  "fade-up 0.4s 320ms ease-out forwards",
        "pulse-accent":"pulse-accent 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
