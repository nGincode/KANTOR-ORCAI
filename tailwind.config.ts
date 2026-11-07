import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#080b14",
          900: "#0b1020",
          850: "#0f1730",
          800: "#131d3a",
          700: "#1c2a4d",
          600: "#2a3c66",
        },
        neon: {
          mint: "#5eead4",
          sky: "#7dd3fc",
          violet: "#a78bfa",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        display: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        panel: "0 20px 60px -20px rgba(2, 6, 23, 0.9)",
        glow: "0 0 40px -8px rgba(94, 234, 212, 0.35)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        blink: "blink 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
