import type { Metadata } from 'next';
import { LocaleProvider } from '@/lib/locale-context';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Claude Farmer — Your Code Grows a Farm',
    template: '%s | Claude Farmer',
  },
  description: 'An idle pixel-art farming game powered by Claude Code. Your coding automatically plants, grows, and harvests crops. Collect 32 gacha items, visit other developers\' farms, leave guestbook notes, and gift items.',
  keywords: ['claude', 'claude-code', 'farming', 'idle-game', 'pixel-art', 'developer-tool', 'cli', 'vscode-extension', 'gacha', 'social-game', 'coding-game'],
  authors: [{ name: 'Claude Farmer', url: 'https://claudefarmer.com' }],
  creator: 'Claude Farmer',
  publisher: 'Claude Farmer',
  metadataBase: new URL('https://claudefarmer.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Claude Farmer — Your Code Grows a Farm',
    description: 'An idle pixel-art farming game powered by Claude Code. Plant, grow, harvest, collect 32 gacha items, and visit other developers\' farms — all by just coding.',
    url: 'https://claudefarmer.com',
    siteName: 'Claude Farmer',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/og', width: 1200, height: 630, alt: 'Claude Farmer — Your Code Grows a Farm' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Claude Farmer — Your Code Grows a Farm',
    description: 'An idle pixel-art farming game powered by Claude Code. 32 gacha items, social features, pixel art. Just code!',
    images: ['/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.png',
  },
  category: 'technology',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Claude Farmer',
  description: 'An idle pixel-art farming game powered by Claude Code. Your coding automatically plants, grows, and harvests crops.',
  url: 'https://claudefarmer.com',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'Claude Farmer',
    url: 'https://github.com/claude-farmer',
  },
  softwareVersion: '0.1.0',
  downloadUrl: 'https://www.npmjs.com/package/claude-farmer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen">
        <LocaleProvider>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
