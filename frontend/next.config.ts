import type { NextConfig } from 'next';
import path from 'path';

// CSP frame-src allowlist. YouTube is for portfolio link embeds (link-paste
// feature). Loom and SquadClips (clips.squadhub.in) are for training program
// lesson videos (admin-curated only, not user-supplied). R2 (pub-*.r2.dev) is
// for portfolio PDFs, which are embedded inline in the profile lightbox via an
// <iframe> pointing at the uploaded file's R2 public URL — without this entry
// frame-src blocks the inline PDF viewer. Backend validators are the actual
// security boundary; CSP is defense-in-depth against a stray iframe URL.
const FRAME_SRC_ALLOWLIST = [
  "'self'",
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://www.loom.com',
  'https://loom.com',
  'https://clips.squadhub.in',
  'https://*.r2.dev',
].join(' ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
  async redirects() {
    return [
      {
        source: '/register/talent',
        destination: '/signup/talent',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-src ${FRAME_SRC_ALLOWLIST};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
