import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        studio: {
          950: "#090B0E",
          900: "#0F1318",
          850: "#141920",
          800: "#1A2029",
          700: "#27313F",
          600: "#3D4B5C",
          500: "#5D6F85",
          400: "#8BA0B8",
        },
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        print: {
          cut:        "#E6007E",
          crease:     "#0084FF",
          bleed:      "#00BA38",
          safety:     "#FF9900",
          panel:      "rgba(59,130,246,0.04)",
          panelHover: "rgba(59,130,246,0.12)",
          panelActive:"rgba(59,130,246,0.22)",
        },
        // Status badge palette
        status: {
          draft:         "#5D6F85",
          cmyk:          "#E6007E",
          mockup:        "#06B6D4",
        },
        // Quota gauge
        quota: {
          low:  "#22C55E",
          mid:  "#F59E0B",
          high: "#EF4444",
        },
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "Courier New", "monospace"],
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-brand": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.35s ease both",
        "fade-in":    "fade-in 0.25s ease both",
        "scale-in":   "scale-in 0.2s ease both",
        "pulse-brand":"pulse-brand 2s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-brand":   "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
        "gradient-mockup":  "linear-gradient(135deg, #0891b2 0%, #0284c7 100%)",
        "gradient-cmyk":    "linear-gradient(135deg, #be185d 0%, #db2777 100%)",
        "gradient-studio":  "linear-gradient(160deg, #0F1318 0%, #141920 100%)",
        "gradient-card":    "linear-gradient(180deg, rgba(26,32,41,0.8) 0%, rgba(15,19,24,0.95) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
