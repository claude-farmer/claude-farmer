import chalk from 'chalk';
import { CHARACTER_TYPES, generateDefaultAppearance } from '@claude-farmer/shared';
import type { CharacterAppearance, CharacterType } from '@claude-farmer/shared';
import { stateExists, loadState, saveState } from '../core/state.js';
import { updateCharacterRemote } from '../sync/remote.js';

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
    if (opts.type && CHARACTER_TYPES.includes(opts.type as CharacterType)) {
      next.type = opts.type as CharacterType;
    }
    if (opts.hairStyle) next.hairStyle = opts.hairStyle as CharacterAppearance['hairStyle'];
    if (opts.hairColor) next.hairColor = opts.hairColor;
    if (opts.skinTone) next.skinTone = opts.skinTone as CharacterAppearance['skinTone'];
    if (opts.eyeStyle) next.eyeStyle = opts.eyeStyle as CharacterAppearance['eyeStyle'];
    if (opts.accessory) next.accessory = opts.accessory as CharacterAppearance['accessory'];
    if (opts.clothesColor) next.clothesColor = opts.clothesColor;
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
