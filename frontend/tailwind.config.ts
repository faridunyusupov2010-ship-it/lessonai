import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F7F4",
        ink: "#16222A",
        mute: "#5B6A72",
        line: "#DDE2DF",
        pen: { DEFAULT: "#2243B6", dark: "#1B3796", soft: "#E8EDFB" },
        marker: "#FFE45C",
        alert: "#C8372D",
        ok: "#1E7F5C",
      },
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        sheet: ["var(--font-sheet)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
