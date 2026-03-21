import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── 키 구조 ──
export const keys = {
  user: (id: string) => `user:${id}`,
  farm: (id: string) => `user:${id}:farm`,
  waterLog: (id: string) => `user:${id}:water_log:${todayKey()}`,
  recentActive: 'global:recent_active',
  subscribers: 'global:email_subscribers',
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
