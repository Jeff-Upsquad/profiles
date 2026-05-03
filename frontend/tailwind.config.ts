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
        /* ── UpSquad Brand (neo-brutalist) ── */
        brand: {
          purple: '#d4ff4d',  // signature lime — primary CTA
          pink: '#a8e8e8',    // mint — secondary accent
          yellow: '#f0fb29',  // bright yellow-green
          blue: '#a8e8e8',    // alias for mint
          green: '#42cc77',   // success
          orange: '#F76808',  // warning/alert
        },
        /* ── Warm cream surfaces ── */
        surface: {
          DEFAULT: '#F7F6F3',     // page background
          secondary: '#F5F5F2',   // cards/sections
          dark: '#090C1D',        // footer/dark sections
        },
        /* ── Text scale ── */
        text: {
          primary: '#0a0a0a',
          secondary: '#525252',
          muted: '#a3a3a3',
        },
        /* ── Legacy primary scale (warm browns) ── */
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
          900: '#090C1D',
        },
      },
      boxShadow: {
        /* ── Neo-brutalist black drop shadows ── */
        'brutal-sm': '3px 3px 0 0 #000',
        'brutal': '4px 4px 0 0 #000',
        'brutal-lg': '6px 6px 0 0 #000',
        'brutal-xl': '8px 8px 0 0 #000',
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
