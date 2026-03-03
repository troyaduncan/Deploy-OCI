import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // T-Mobile brand palette
        magenta: {
          DEFAULT: "#E20074",
          dark: "#B5005B",
          light: "#FF1A85",
        },
        // Dark theme surface colors
        surface: {
          950: "#0A0A0A",
          900: "#111111",
          800: "#1A1A1A",
          700: "#242424",
          600: "#2E2E2E",
          400: "#666666",
          200: "#AAAAAA",
        },
        // Status colors
        status: {
          success: "#22C55E",
          failed: "#EF4444",
          running: "#3B82F6",
          pending: "#78716C",
          skipped: "#6B7280",
          cancelled: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
