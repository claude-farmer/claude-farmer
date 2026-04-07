import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

// Backward-compatible export (lazy getter)
export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    return (getRedis() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ── 키 구조 ──
export const keys = {
  user: (id: string) => `user:${id}`,
  farm: (id: string) => `user:${id}:farm`,
  waterLog: (id: string) => `user:${id}:water_log:${todayKey()}`,
  recentActive: 'global:recent_active',
  subscribers: 'global:email_subscribers',
  // 소셜: 방문 & 발자국
  visitors: (id: string) => `farm:${id}:visitors`,
  footprints: (id: string) => `farm:${id}:footprints`,
  waterDetail: (id: string) => `farm:${id}:water_detail:${todayKey()}`,
  bookmarks: (id: string) => `user:${id}:bookmarks`,
  nicknameIndex: 'global:nickname_index',
  // 방명록 & 물 쿨다운
  guestbook: (id: string) => `farm:${id}:guestbook`,
  totalWaterReceived: (id: string) => `farm:${id}:total_water_received`,
  totalVisitors: (id: string) => `farm:${id}:total_visitors`,
  waterCooldown: (id: string) => `user:${id}:water_cooldown`,
  // 선물
  gifts: (id: string) => `farm:${id}:gifts`,
  totalGiftsReceived: (id: string) => `farm:${id}:total_gifts_received`,
  // 북마크 카운터 (이 농장을 북마크한 유저 수)
  totalBookmarks: (id: string) => `farm:${id}:total_bookmarks`,
  // 누적 랭킹 (sorted set: member=user_id, score=누적 카운트)
  waterByUser: (id: string) => `farm:${id}:water_by_user`,
  giftsByUser: (id: string) => `farm:${id}:gifts_by_user`,
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
