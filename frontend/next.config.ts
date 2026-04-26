import type { NextConfig } from 'next';

// CSP frame-src allowlist for portfolio link embeds. We intentionally only
// declare `frame-src` (and not other directives) so existing inline scripts
// and image hosts remain unrestricted — adding a full CSP is out of scope
// here. Backend re-validation in talent.service is the actual security
// boundary; this is defense-in-depth against an iframe URL slipping past the
// parser.
// NOTE: 'https://drive.google.com' was previously listed here but removed
// after Google Drive support was dropped from the link-paste feature. Any
// historical portfolio rows with provider='gdrive' (we measured ~1 in
// production at the time of this change) will now show a blank iframe in
// the lightbox. Re-add the entry if you need to keep those rows working.
const FRAME_SRC_ALLOWLIST = [
  "'self'",
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.loom.com',
  'https://*.dropbox.com',
  'https://*.dropboxusercontent.com',
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
