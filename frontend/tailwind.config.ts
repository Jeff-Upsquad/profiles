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
        /* ── UpSquad Brand (monochrome + pale-yellow accent) ── */
        brand: {
          purple: '#FFFF99',  // signature pale-yellow — primary accent
          pink: '#E7E7EA',    // neutral grey — secondary surface
          yellow: '#FFFF99',  // pale-yellow accent
          blue: '#E7E7EA',    // neutral grey
          green: '#42cc77',   // success (functional status)
          orange: '#F76808',  // warning/alert (functional status)
        },
        /* ── Surfaces (white + cool greys) ── */
        surface: {
          DEFAULT: '#FFFFFF',     // page background
          secondary: '#F5F5F6',   // cards/sections
          dark: '#1C1C1F',        // footer/dark sections
        },
        /* ── Text scale ── */
        text: {
          primary: '#0a0a0a',
          secondary: '#525252',
          muted: '#a3a3a3',
        },
        /* ── Primary neutral scale (cool greys) ── */
        primary: {
          50: '#fafafa',
          100: '#f5f5f6',
          200: '#e7e7ea',
          300: '#d4d4d8',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#3f3f46',
          800: '#27272a',
          900: '#0a0a0a',
        },
        warm: {
          bg: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E7E7EA',
        },
        accent: {
          DEFAULT: '#1a1a1a',
          soft: '#4a4a4a',
          muted: '#8a8a8a',
        },
        dark: {
          900: '#1C1C1F',
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
