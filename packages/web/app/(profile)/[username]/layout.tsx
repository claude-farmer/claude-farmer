import type { Metadata } from 'next';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

const SITE = 'https://claudefarmer.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await redis.get<PublicProfile>(keys.user(username)).catch(() => null);

  // 캐시 버스터: 프로필 갱신 시간 반영 (없으면 username만)
  const v = profile?.last_active ? new Date(profile.last_active).getTime() : Date.now();
  const ogUrl = `${SITE}/${encodeURIComponent(username)}/og?v=${v}`;

  if (!profile) {
    return {
      title: `@${username}`,
      description: `${username}'s farm on Claude Farmer`,
      openGraph: {
        title: `@${username} — Claude Farmer`,
        description: `${username}'s farm on Claude Farmer`,
        url: `${SITE}/@${username}`,
        images: [{ url: ogUrl, width: 1200, height: 630, alt: `${username}'s farm` }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `@${username} — Claude Farmer`,
        images: [ogUrl],
      },
    };
  }

  const title = `${profile.nickname} — Claude Farmer`;
  const desc = `Lv.${profile.level} · ${profile.total_harvests ?? 0} harvests · ${profile.unique_items ?? 0}/32 codex`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE}/@${username}`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${profile.nickname}'s farm` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [ogUrl],
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
