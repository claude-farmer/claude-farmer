import { redirect } from 'next/navigation';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await redis.get<PublicProfile>(keys.user(username));

  if (!profile) {
    return { title: 'Farm Not Found | Claude Farmer' };
  }

  const title = `${profile.nickname}'s Farm — Claude Farmer`;
  const description = `Lv.${profile.level} · ${profile.total_harvests} harvests · ${profile.unique_items ?? 0}/32 items${profile.streak_days ? ` · 🔥${profile.streak_days}d streak` : ''}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://claudefarmer.com/farm/${username}`,
      siteName: 'Claude Farmer',
      images: [{
        url: `/farm/${username}/og`,
        width: 1200,
        height: 630,
        alt: title,
      }],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/farm/${username}/og`],
    },
  };
}

export default async function FarmProfilePage({ params }: Props) {
  const { username } = await params;

  // /farm?visit=username 으로 리다이렉트 (기존 방문 플로우 재사용)
  redirect(`/farm?visit=${encodeURIComponent(username)}`);
}
