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
    const title = `@${username}'s Farm — Claude Farmer · Code Grows a Farm`;
    const desc = `${username} hasn't started farming yet. Install claude-farmer and your code automatically plants, grows, and harvests crops in a cute pixel-art farm.`;
    return {
      title,
      description: desc,
      openGraph: {
        title,
        description: desc,
        url: `${SITE}/@${username}`,
        siteName: 'Claude Farmer',
        type: 'profile',
        images: [{ url: ogUrl, width: 1200, height: 630, alt: `${username}'s farm on Claude Farmer` }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: desc,
        images: [ogUrl],
      },
    };
  }

  const harvests = profile.total_harvests ?? 0;
  const items = profile.unique_items ?? 0;
  const streak = profile.streak_days ?? 0;
  const title = `${profile.nickname}'s Farm · Lv.${profile.level} — Claude Farmer`;
  const desc = `${profile.nickname} is growing a pixel-art farm by coding with Claude. ${harvests} harvests · ${items}/32 gacha items collected · ${streak}-day streak. Visit and water their crops!`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `${SITE}/@${username}`,
      siteName: 'Claude Farmer',
      type: 'profile',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${profile.nickname}'s farm on Claude Farmer` }],
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
