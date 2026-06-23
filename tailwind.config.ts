import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mist: "#f5f7fb",
        panel: "#ffffff",
        line: "#d8e0eb",
        teal: "#0f9f9a",
        ocean: "#2356a3",
        coral: "#d95d5d",
        amber: "#d68b1f",
        plum: "#7657b8"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 51, 0.08)",
        glow: "0 24px 80px rgba(35, 86, 163, 0.18)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.95" }
        }
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        pulseSoft: "pulseSoft 4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
