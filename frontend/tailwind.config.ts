import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/views/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#faf9f7',
          100: '#f5f3ef',
          200: '#e8e5de',
          300: '#d4cfc5',
          400: '#b8b0a2',
          500: '#9c9283',
          600: '#7a6f5f',
          700: '#5c5347',
          800: '#3d3730',
          900: '#1f1b17',
        },
        warm: {
          bg: '#F7F6F3',
          card: '#FFFFFF',
          border: '#E8E5DE',
        },
        accent: {
          DEFAULT: '#1a1a1a',
          soft: '#4a4a4a',
          muted: '#8a8a8a',
        },
        dark: {
          900: '#0f172a',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
