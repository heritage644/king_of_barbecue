import { fileURLToPath } from 'node:url';

const emptyNodeStub = fileURLToPath(new URL('./stubs/empty.js', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kob/core'],
  async rewrites() {
    const api = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${api}/api/:path*`,
      },
    ];
  },
  images: {
    // Local food photography only — no remote patterns needed in Phase 1.
    formats: ['image/avif', 'image/webp'],
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      bullmq: emptyNodeStub,
      ioredis: emptyNodeStub,
    };
    return config;
  },
};

export default nextConfig;
