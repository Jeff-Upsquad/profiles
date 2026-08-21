import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next 15.5 still ships an eslintrc-style config only, so it has
// to be bridged into flat config with FlatCompat.
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'],
  },

  // Brings in @next/next, react, react-hooks and jsx-a11y, including
  // react-hooks/rules-of-hooks.
  ...compat.extends('next/core-web-vitals'),

  {
    rules: {
      // The reason this config exists. Conditional hooks shipped to production
      // once already: both bottom navs had an early `return null` for chat
      // thread routes sitting above their remaining hooks, so navigating into
      // a chatroom re-rendered the same component instance with fewer hooks
      // than the render before it. React throws on that, and with no error
      // boundary above the layout the whole app fell back to "Application
      // error: a client-side exception has occurred". Stated explicitly and
      // pinned at 'error' so it survives any change to the preset's defaults —
      // this rule catches crashes, not style.
      'react-hooks/rules-of-hooks': 'error',

      // Below: pre-existing findings, deliberately scoped down rather than
      // refactored away. They are real but cosmetic/perf-level, they predate
      // linting in this package, and leaving them at 'error' would mean
      // several hundred untriaged edits before `npm run lint` could pass at
      // all — and would block deploys on them. Warnings keep them visible so
      // they can be worked down file by file.

      // Only flags the characters that signal genuinely broken markup. The
      // default also forbids apostrophes and quotes in JSX text, which here is
      // just ordinary English copy ("we'll", "you're") that renders correctly
      // as-is; escaping it buys nothing and makes the copy harder to read.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],

      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-img-element': 'warn',
    },
  },
];

export default config;
