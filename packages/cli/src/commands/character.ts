import chalk from 'chalk';
import { CHARACTER_TYPES, CHARACTER_HAIR_COLORS, CHARACTER_CLOTHES_COLORS, generateDefaultAppearance } from '@claude-farmer/shared';
import type { CharacterAppearance, CharacterType } from '@claude-farmer/shared';
import { stateExists, loadState, saveState } from '../core/state.js';
import { updateCharacterRemote } from '../sync/remote.js';

const HAIR_COLOR_KEYS = Object.keys(CHARACTER_HAIR_COLORS);
const CLOTHES_COLOR_KEYS = Object.keys(CHARACTER_CLOTHES_COLORS);

const HAIR_STYLES = ['short', 'long', 'curly', 'ponytail', 'bun', 'spiky', 'bob', 'buzz'] as const;
const SKIN_TONES = ['light', 'medium', 'dark', 'pale'] as const;
const EYE_STYLES = ['dot', 'round', 'line', 'star', 'closed'] as const;
const ACCESSORIES = ['none', 'glasses', 'sunglasses', 'eyepatch', 'bandaid'] as const;

function validate<T extends readonly string[]>(value: string | undefined, allowed: T, label: string): T[number] | null {
  if (!value) return null;
  if ((allowed as readonly string[]).includes(value)) return value as T[number];
  console.log(chalk.red(`❌ Invalid ${label}: "${value}". Allowed: ${allowed.join(', ')}`));
  return null;
}

interface CharacterOptions {
  type?: string;
  hairStyle?: string;
  hairColor?: string;
  skinTone?: string;
  eyeStyle?: string;
  accessory?: string;
  clothesColor?: string;
  random?: boolean;
  show?: boolean;
}

export async function characterCommand(opts: CharacterOptions): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('🌱 Run `claude-farmer init` first.'));
    return;
  }

  const state = await loadState();

  if (opts.show || (Object.keys(opts).length === 0)) {
    const c = state.user.character ?? generateDefaultAppearance(state.user.github_id);
    console.log('');
    console.log(chalk.green.bold('🧑 Your character'));
    console.log(chalk.dim('━'.repeat(40)));
    console.log(`  type:        ${c.type}`);
    if (c.type === 'human') {
      console.log(`  hairStyle:   ${c.hairStyle ?? 'short'}`);
      console.log(`  hairColor:   ${c.hairColor ?? 'brown'}`);
      console.log(`  skinTone:    ${c.skinTone ?? 'light'}`);
    }
    console.log(`  eyeStyle:    ${c.eyeStyle ?? 'dot'}`);
    console.log(`  accessory:   ${c.accessory ?? 'none'}`);
    console.log(`  clothesColor:${c.clothesColor ?? 'blue'}`);
    console.log('');
    console.log(chalk.dim('Examples:'));
    console.log(chalk.dim(`  claude-farmer character --type bear --clothesColor red`));
    console.log(chalk.dim(`  claude-farmer character --random`));
    console.log(chalk.dim(`  Available types: ${CHARACTER_TYPES.join(', ')}`));
    console.log('');
    return;
  }

  let next: CharacterAppearance;
  if (opts.random) {
    next = generateDefaultAppearance(`${state.user.github_id}-${Date.now()}`);
  } else {
    const current = state.user.character ?? generateDefaultAppearance(state.user.github_id);
    next = { ...current };

    if (opts.type) {
      if (!CHARACTER_TYPES.includes(opts.type as CharacterType)) {
        console.log(chalk.red(`❌ Invalid type: "${opts.type}". Allowed: ${CHARACTER_TYPES.join(', ')}`));
        return;
      }
      next.type = opts.type as CharacterType;
    }
    const hs = validate(opts.hairStyle, HAIR_STYLES, 'hairStyle');
    if (opts.hairStyle && hs === null) return;
    if (hs) next.hairStyle = hs;

    const st = validate(opts.skinTone, SKIN_TONES, 'skinTone');
    if (opts.skinTone && st === null) return;
    if (st) next.skinTone = st;

    const es = validate(opts.eyeStyle, EYE_STYLES, 'eyeStyle');
    if (opts.eyeStyle && es === null) return;
    if (es) next.eyeStyle = es;

    const ac = validate(opts.accessory, ACCESSORIES, 'accessory');
    if (opts.accessory && ac === null) return;
    if (ac) next.accessory = ac;

    if (opts.hairColor) {
      if (!HAIR_COLOR_KEYS.includes(opts.hairColor)) {
        console.log(chalk.red(`❌ Invalid hairColor: "${opts.hairColor}". Allowed: ${HAIR_COLOR_KEYS.join(', ')}`));
        return;
      }
      next.hairColor = opts.hairColor;
    }
    if (opts.clothesColor) {
      if (!CLOTHES_COLOR_KEYS.includes(opts.clothesColor)) {
        console.log(chalk.red(`❌ Invalid clothesColor: "${opts.clothesColor}". Allowed: ${CLOTHES_COLOR_KEYS.join(', ')}`));
        return;
      }
      next.clothesColor = opts.clothesColor;
    }
  }

  state.user.character = next;
  await saveState(state);

  const ok = await updateCharacterRemote(next, state.user.github_id);
  if (ok) {
    console.log(chalk.green(`✅ Character updated to ${next.type}.`));
  } else {
    console.log(chalk.yellow(`⚠️  Saved locally; server sync failed.`));
  }
}
