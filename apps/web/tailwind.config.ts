import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#c2410c',
          light: '#ea580c',
          dark: '#7c2d12',
        },
        ember: '#f97316',
        charcoal: {
          DEFAULT: '#1c1917',
          light: '#292524',
          lighter: '#44403c',
        },
        cream: '#faf6f0',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(28,25,23,0.08)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(234,88,12,0.5)' },
          '70%': { boxShadow: '0 0 0 12px rgba(234,88,12,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(234,88,12,0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
