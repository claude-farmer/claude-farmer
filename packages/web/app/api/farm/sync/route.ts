import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';
import { GRID_SIZE, CHARACTER_TYPES } from '@claude-farmer/shared';
import type { PublicProfile, Farm, CharacterAppearance } from '@claude-farmer/shared';

const VALID_HAIR_STYLES = ['short', 'long', 'curly', 'ponytail', 'bun', 'spiky', 'bob', 'buzz'] as const;
const VALID_SKIN_TONES = ['light', 'medium', 'dark', 'pale'] as const;
const VALID_EYE_STYLES = ['dot', 'round', 'line', 'star', 'closed'] as const;
const VALID_ACCESSORIES = ['none', 'glasses', 'sunglasses', 'eyepatch', 'bandaid'] as const;
const VALID_HAIR_COLORS = ['brown', 'black', 'blonde', 'red', 'pink', 'blue', 'white', 'green'] as const;
const VALID_CLOTHES_COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'pink', 'teal', 'yellow'] as const;

function validateCharacter(raw: unknown): CharacterAppearance | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const type = c.type as string;
  if (!CHARACTER_TYPES.includes(type as typeof CHARACTER_TYPES[number])) return undefined;

  const result: CharacterAppearance = { type: type as CharacterAppearance['type'] };
  if (type === 'human') {
    if (c.hairStyle && VALID_HAIR_STYLES.includes(c.hairStyle as typeof VALID_HAIR_STYLES[number])) result.hairStyle = c.hairStyle as CharacterAppearance['hairStyle'];
    if (c.hairColor && VALID_HAIR_COLORS.includes(c.hairColor as typeof VALID_HAIR_COLORS[number])) result.hairColor = c.hairColor as string;
    if (c.skinTone && VALID_SKIN_TONES.includes(c.skinTone as typeof VALID_SKIN_TONES[number])) result.skinTone = c.skinTone as CharacterAppearance['skinTone'];
  }
  if (c.eyeStyle && VALID_EYE_STYLES.includes(c.eyeStyle as typeof VALID_EYE_STYLES[number])) result.eyeStyle = c.eyeStyle as CharacterAppearance['eyeStyle'];
  if (c.accessory && VALID_ACCESSORIES.includes(c.accessory as typeof VALID_ACCESSORIES[number])) result.accessory = c.accessory as CharacterAppearance['accessory'];
  if (c.clothesColor && VALID_CLOTHES_COLORS.includes(c.clothesColor as typeof VALID_CLOTHES_COLORS[number])) result.clothesColor = c.clothesColor as string;
  return result;
}

// CLI/Web에서 농장 상태를 서버에 동기화
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { github_id, nickname, avatar_url, level, total_harvests, unique_items, streak_days, today_input_chars, today_harvests, today_water_given, inventory, status_message, farm, character } = body;

    const userId = extractUserId(request, github_id);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CLI에서 body로 보낸 github_id가 인증된 유저와 일치하는지 확인
    // (session cookie 경우 이미 추출됨, CLI 경우 동일)
    // 최소 검증: 해당 유저가 Redis에 존재하는지 확인
    const existing = await redis.get<PublicProfile>(keys.user(userId));
    if (!existing && userId !== github_id) {
      // session 유저와 body 유저가 다르면 거부
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const profile: PublicProfile = {
      nickname: (nickname || userId).slice(0, 50),
      avatar_url: (avatar_url || '').slice(0, 500),
      level: level || 1,
      total_harvests: total_harvests || 0,
      unique_items: typeof unique_items === 'number' ? unique_items : undefined,
      streak_days: typeof streak_days === 'number' ? streak_days : undefined,
      today_input_chars: typeof today_input_chars === 'number' ? today_input_chars : undefined,
      today_harvests: typeof today_harvests === 'number' ? today_harvests : undefined,
      today_water_given: typeof today_water_given === 'number' ? today_water_given : undefined,
      inventory: Array.isArray(inventory) ? inventory.slice(0, 100).map((item: Record<string, unknown>) => ({
        id: String(item.id || '').slice(0, 20),
        name: String(item.name || '').slice(0, 50),
        rarity: (['common', 'rare', 'epic', 'legendary'] as const).includes(item.rarity as 'common') ? item.rarity as 'common' | 'rare' | 'epic' | 'legendary' : 'common' as const,
        obtained_at: String(item.obtained_at || ''),
      })) : undefined,
      // status_message가 null로 오면 서버 기존 값 유지 (웹/VSCode 편집 덮어쓰기 방지)
      status_message: status_message ? {
        ...status_message,
        text: (status_message.text || '').slice(0, 200),
        link: status_message.link ? (status_message.link as string).slice(0, 500) : undefined,
      } : (existing?.status_message ?? null),
      farm_snapshot: farm || { level: 1, grid: new Array(GRID_SIZE).fill(null), total_harvests: 0 },
      last_active: new Date().toISOString(),
      character: validateCharacter(character),
    };

    await redis.set(keys.user(userId), profile);
    await redis.zadd(keys.recentActive, { score: Date.now(), member: userId });
    // 닉네임 → github_id 인덱스 (검색용)
    await redis.hset(keys.nicknameIndex, { [profile.nickname.toLowerCase()]: userId });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
