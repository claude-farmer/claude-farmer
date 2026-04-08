import chalk from 'chalk';
import type { Rarity } from '@claude-farmer/shared';
import { RARITY_LABEL, GACHA_ITEMS, TOTAL_ITEMS, t, getEvolutionTier, getItemCounts } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';
import { getLocale } from '../core/config.js';

const rarityChalk: Record<Rarity, (s: string) => string> = {
  common: (s) => chalk.gray(s),
  rare: (s) => chalk.blue(s),
  epic: (s) => chalk.magenta(s),
  legendary: (s) => chalk.yellow(s),
};

export async function bagCommand(): Promise<void> {
  const locale = getLocale();

  if (!stateExists()) {
    console.log(chalk.yellow(`\n🌱 ${t(locale, 'initFirst')}\n`));
    return;
  }

  const state = await loadState();
  const ownedIds = new Set(state.inventory.map(i => i.id));
  const uniqueCount = ownedIds.size;
  const itemCounts = getItemCounts(state.inventory);

  console.log('');
  console.log(chalk.bold(`📖 ${t(locale, 'bagTitle')}  ${uniqueCount}/${TOTAL_ITEMS} ${t(locale, 'bagCollected')}`));
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
        const count = itemCounts.get(item.id) || 0;
        const tier = getEvolutionTier(count);
        const starStr = tier.label ? ` ${tier.label}` : '';
        const countStr = count > 1 ? ` ×${count}` : '';
        return colorFn(`[${chalk.dim(item.id)} ${item.name}${starStr}${countStr}]`);
      }
      return chalk.dim('[??]');
    });
    console.log(items.join(' '));
  }
  console.log('');
  console.log(chalk.dim('💡 Use the dim id (e.g. c01) for `claude-farmer gift @user <id>`'));
  console.log('');
}
