import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/admin',
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
