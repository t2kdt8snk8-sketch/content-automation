import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0c0f12",
        cream: "#f7f1e8",
        sand: "#dccbb4",
        bronze: "#a46a3d",
        mint: "#1db57a",
        amber: "#f59e0b",
        rose: "#c46565",
      },
      boxShadow: {
        panel: "0 20px 40px rgba(12, 15, 18, 0.12)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at top, rgba(164, 106, 61, 0.22), transparent 38%), radial-gradient(circle at 80% 20%, rgba(29, 181, 122, 0.16), transparent 25%)",
      },
    },
  },
  plugins: [],
};

export default config;
