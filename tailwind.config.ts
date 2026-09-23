import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ice: {
          50: "#f2f7fb",
          100: "#e2edf5",
          200: "#c3dbec",
          800: "#0f2f4a",
          900: "#0a1f33",
        },
        rink: "#0a1f33",
        gold: "#c9a227",
        silver: "#9aa5ad",
        bronze: "#a5652f",
        accent: "#2fb6a3",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
