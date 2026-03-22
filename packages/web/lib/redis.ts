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
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
