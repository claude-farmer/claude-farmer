import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@claude-farmer/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // VSCode webview (vscode-webview://) 에서 iframe 으로 로드할 수 있도록 허용
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' vscode-webview: vscode-file:",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
