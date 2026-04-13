/** @type {import('tailwindcss').Config} */
/**
 * Tailwind Config — Design Tokens via CSS Variables
 *
 * Hex 코드를 직접 쓰지 않습니다.
 * 모든 값은 tokens.css에 정의된 CSS 변수(var(--...))를 참조합니다.
 * 실제 색상 값은 theme.js 또는 tokens.css에서 관리하세요.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: {
          default: "var(--color-border-default)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
        },
        background: {
          primary: "var(--color-background-primary)",
          secondary: "var(--color-background-secondary)",
        },
        brand: {
          primary: "var(--color-brand-primary)",
          secondary: "var(--color-brand-secondary)",
        },
      },

      fontFamily: {
        sans: ["var(--font-family-base)"],
      },

      fontSize: {
        /** type/size/14 — line-height: type/line-height/20 */
        "token-sm": [
          "var(--type-size-14)",
          { lineHeight: "var(--type-line-height-20)", letterSpacing: "var(--type-letter-spacing-0)" },
        ],
        /** type/size/16 — line-height: type/line-height/24 */
        "token-base": [
          "var(--type-size-16)",
          { lineHeight: "var(--type-line-height-24)", letterSpacing: "var(--type-letter-spacing-0)" },
        ],
        /** type/size/38 — line-height: type/line-height/38 */
        "token-3xl": [
          "var(--type-size-38)",
          { lineHeight: "var(--type-line-height-38)", letterSpacing: "var(--type-letter-spacing-0)" },
        ],
      },

      fontWeight: {
        regular: "var(--font-weight-regular)",
        semibold: "var(--font-weight-semibold)",
        bold: "var(--font-weight-bold)",
      },
    },
  },
  plugins: [],
};
