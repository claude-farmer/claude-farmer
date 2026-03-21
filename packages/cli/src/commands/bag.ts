import chalk from 'chalk';
import type { Rarity } from '@claude-farmer/shared';
import { RARITY_LABEL, RARITY_COLOR, GACHA_ITEMS, TOTAL_ITEMS } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';

const rarityChalk: Record<Rarity, (s: string) => string> = {
  common: (s) => chalk.gray(s),
  rare: (s) => chalk.blue(s),
  epic: (s) => chalk.magenta(s),
  legendary: (s) => chalk.yellow(s),
};

export async function bagCommand(): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('\n🌱 먼저 `claude-farmer init`으로 시작해주세요.\n'));
    return;
  }

  const state = await loadState();
  const ownedIds = new Set(state.inventory.map(i => i.id));
  const uniqueCount = ownedIds.size;

  console.log('');
  console.log(chalk.bold(`📖 도감  ${uniqueCount}/${TOTAL_ITEMS} 수집`));
  console.log(chalk.dim('━'.repeat(35)));

  const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  for (const rarity of rarities) {
    const pool = GACHA_ITEMS.filter(i => i.rarity === rarity);
    const owned = pool.filter(i => ownedIds.has(i.id));
    const pct = Math.round(owned.length / pool.length * 100);

    const bar = '━'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    const colorFn = rarityChalk[rarity];

    console.log(`\n${colorFn(RARITY_LABEL[rarity])} ${bar} ${owned.length}/${pool.length}`);

    const items = pool.map(item => {
      if (ownedIds.has(item.id)) {
        return colorFn(`[${item.name}]`);
      }
      return chalk.dim('[??]');
    });
    console.log(items.join(' '));
  }
  console.log('');
}
