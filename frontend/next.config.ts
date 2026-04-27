import type { NextConfig } from 'next';

// CSP frame-src allowlist for portfolio link embeds. The link-paste feature
// is currently scoped to YouTube only — Vimeo/Loom/Dropbox/Drive entries
// have been trimmed. Backend re-validation in talent.service is the actual
// security boundary; CSP is defense-in-depth against an iframe URL slipping
// past the parser. Historical rows with non-YouTube providers will render a
// blank iframe in the lightbox (we audited and there are none in prod at
// the time of this trim).
const FRAME_SRC_ALLOWLIST = [
  "'self'",
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
].join(' ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
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
