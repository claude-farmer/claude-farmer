import type { MetadataRoute } from 'next';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

const SITE = 'https://claudefarmer.com';

export const revalidate = 3600; // 1시간마다 재생성

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE}/farm`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // 활성 프로필 (최대 1000명) 추가
  try {
    const userIds = (await redis.zrange(keys.recentActive, 0, 999, { rev: true })) as string[];
    const profiles = await Promise.all(
      userIds.map(id => redis.get<PublicProfile>(keys.user(id)).catch(() => null))
    );
    for (let i = 0; i < userIds.length; i++) {
      const id = userIds[i];
      const profile = profiles[i];
      const lastMod = profile?.last_active ? new Date(profile.last_active) : new Date();
      base.push({
        url: `${SITE}/@${id}`,
        lastModified: lastMod,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  } catch {
    // Redis 실패 시 base만 반환
  }

  return base;
}
