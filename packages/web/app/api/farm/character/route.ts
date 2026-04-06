import { NextRequest, NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';
import { extractUserId } from '@/lib/session';
import type { PublicProfile, CharacterAppearance } from '@claude-farmer/shared';
import { CHARACTER_TYPES } from '@claude-farmer/shared';

const VALID_HAIR_STYLES = ['short', 'long', 'curly', 'ponytail', 'bun', 'spiky', 'bob', 'buzz'] as const;
const VALID_SKIN_TONES = ['light', 'medium', 'dark', 'pale'] as const;
const VALID_EYE_STYLES = ['dot', 'round', 'line', 'star', 'closed'] as const;
const VALID_ACCESSORIES = ['none', 'glasses', 'sunglasses', 'eyepatch', 'bandaid'] as const;
const VALID_HAIR_COLORS = ['brown', 'black', 'blonde', 'red', 'pink', 'blue', 'white', 'green'] as const;
const VALID_CLOTHES_COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'pink', 'teal', 'yellow'] as const;

function validateCharacter(raw: unknown): CharacterAppearance | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;

  const type = c.type as string;
  if (!CHARACTER_TYPES.includes(type as typeof CHARACTER_TYPES[number])) return null;

  const result: CharacterAppearance = { type: type as CharacterAppearance['type'] };

  if (type === 'human') {
    if (c.hairStyle && VALID_HAIR_STYLES.includes(c.hairStyle as typeof VALID_HAIR_STYLES[number])) {
      result.hairStyle = c.hairStyle as CharacterAppearance['hairStyle'];
    }
    if (c.hairColor && VALID_HAIR_COLORS.includes(c.hairColor as typeof VALID_HAIR_COLORS[number])) {
      result.hairColor = c.hairColor as string;
    }
    if (c.skinTone && VALID_SKIN_TONES.includes(c.skinTone as typeof VALID_SKIN_TONES[number])) {
      result.skinTone = c.skinTone as CharacterAppearance['skinTone'];
    }
  }

  if (c.eyeStyle && VALID_EYE_STYLES.includes(c.eyeStyle as typeof VALID_EYE_STYLES[number])) {
    result.eyeStyle = c.eyeStyle as CharacterAppearance['eyeStyle'];
  }
  if (c.accessory && VALID_ACCESSORIES.includes(c.accessory as typeof VALID_ACCESSORIES[number])) {
    result.accessory = c.accessory as CharacterAppearance['accessory'];
  }
  if (c.clothesColor && VALID_CLOTHES_COLORS.includes(c.clothesColor as typeof VALID_CLOTHES_COLORS[number])) {
    result.clothesColor = c.clothesColor as string;
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { character, github_id } = body;

    const userId = extractUserId(request, github_id);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await redis.get<PublicProfile>(keys.user(userId));
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const validated = validateCharacter(character);
    if (!validated) {
      return NextResponse.json({ error: 'Invalid character data' }, { status: 400 });
    }

    profile.character = validated;
    await redis.set(keys.user(userId), profile);

    return NextResponse.json({ ok: true, character: validated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
