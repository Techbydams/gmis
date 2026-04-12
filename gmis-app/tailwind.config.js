/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans:    ["DM Sans",   "system-ui", "sans-serif"],
        display: ["Syne",      "system-ui", "sans-serif"],
        mono:    ["monospace"],
      },
      colors: {
        navy: {
          950: "#03071a",
          900: "#060d1f",
          800: "#0b1628",
          700: "#0f2040",
        },
        brand: {
          blue:   "#2d6cff",
          indigo: "#4f3ef8",
          gold:   "#f0b429",
          cyan:   "#00d2ff",
        },
        text: {
          primary:   "#e8eeff",
          secondary: "#7a8bbf",
          muted:     "#3d4f7a",
        },
        surface: {
          DEFAULT: "rgba(255,255,255,0.03)",
          hover:   "rgba(255,255,255,0.06)",
          border:  "rgba(255,255,255,0.08)",
        },
        status: {
          success: "#4ade80",
          warning: "#fbbf24",
          error:   "#f87171",
          info:    "#60a5fa",
          purple:  "#c084fc",
        },
      },
      spacing: {
        "4.5": "18px",
        "13":  "52px",
        "15":  "60px",
        "18":  "72px",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        "brand-sm": "0 4px 14px rgba(45,108,255,0.25)",
        "brand-md": "0 8px 28px rgba(45,108,255,0.35)",
        "brand-lg": "0 16px 48px rgba(45,108,255,0.45)",
      },
    },
  },
  plugins: [],
};