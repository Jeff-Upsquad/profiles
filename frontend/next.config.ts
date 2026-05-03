import type { NextConfig } from 'next';
import path from 'path';

// CSP frame-src allowlist. YouTube is for portfolio link embeds (link-paste
// feature). Loom is for training program lesson videos (admin-curated only,
// not user-supplied). Backend validators are the actual security boundary;
// CSP is defense-in-depth against a stray iframe URL.
const FRAME_SRC_ALLOWLIST = [
  "'self'",
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://www.loom.com',
  'https://loom.com',
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
