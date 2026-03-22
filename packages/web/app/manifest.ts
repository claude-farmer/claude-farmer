import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Claude Farmer',
    short_name: 'Claude Farmer',
    description: 'Your code grows a farm. An idle pixel-art farming game powered by Claude Code.',
    start_url: '/farm',
    display: 'standalone',
    background_color: '#1a1d27',
    theme_color: '#fbbf24',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
