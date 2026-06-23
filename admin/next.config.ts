import type { NextConfig } from 'next';

// The admin codebase is built TWICE: once as the full admin panel (default,
// served at /admin) and once as the restricted staff portal (NEXT_PUBLIC_APP_MODE
// =staff, served at /staff). Same source, separate runtime app — the shared shell
// (AuthContext / api client / sidebar) branches on APP_MODE so the staff build
// uses staff auth + token and a permission-filtered, grant-gated UI.
const STAFF = process.env.NEXT_PUBLIC_APP_MODE === 'staff';

const nextConfig: NextConfig = {
  basePath: STAFF ? '/staff' : '/admin',
  // Separate build output so the two builds never clobber each other.
  distDir: STAFF ? '.next-staff' : '.next',
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    const backendPort = process.env.BACKEND_PORT ?? '5000';
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `http://localhost:${backendPort}/api/:path*`,
          basePath: false,
        },
      ],
    };
  },
};

export default nextConfig;
