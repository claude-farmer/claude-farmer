import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@claude-farmer/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
