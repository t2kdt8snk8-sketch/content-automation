/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                minecraft: {
                    dark: '#0a0a0f',
                    darker: '#060609',
                    card: 'rgba(20, 20, 35, 0.8)',
                    border: 'rgba(74, 222, 128, 0.15)',
                    accent: '#4ade80',
                    'accent-dim': '#22c55e',
                    'accent-glow': 'rgba(74, 222, 128, 0.3)',
                    gold: '#fbbf24',
                    diamond: '#67e8f9',
                },
            },
            fontFamily: {
                pixel: ['"Press Start 2P"', 'monospace'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-up': 'fadeUp 0.6s ease-out',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'grid-appear': 'gridAppear 0.3s ease-out',
                'float': 'float 3s ease-in-out infinite',
            },
            keyframes: {
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 5px rgba(74, 222, 128, 0.2)' },
                    '50%': { boxShadow: '0 0 20px rgba(74, 222, 128, 0.4)' },
                },
                gridAppear: {
                    '0%': { opacity: '0', transform: 'scale(0.8)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
        },
    },
    plugins: [],
}
