import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '🌱 Claude Farmer — Your Code Grows a Farm',
  description: 'Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임. 코딩하면 씨앗이 심기고, 수확하면 가챠! 다른 개발자 농장에 놀러가서 물도 줄 수 있어요.',
  keywords: ['claude', 'claude-code', 'farming', 'idle-game', 'pixel-art', 'developer-tool'],
  authors: [{ name: 'Claude Farmer' }],
  metadataBase: new URL('https://claudefarmer.com'),
  openGraph: {
    title: '🌱 Claude Farmer — Your Code Grows a Farm',
    description: 'Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임',
    url: 'https://claudefarmer.com',
    siteName: 'Claude Farmer',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/og', width: 1200, height: 630, alt: 'Claude Farmer' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '🌱 Claude Farmer',
    description: 'Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임',
    images: ['/og'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
