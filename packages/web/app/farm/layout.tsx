import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Farm — Claude Farmer',
  description: 'Open your Claude Farmer profile. Redirects to your personal farm page.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://claudefarmer.com/farm' },
};

export default function FarmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
