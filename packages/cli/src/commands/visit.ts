import chalk from 'chalk';
import { CROP_EMOJI, GRID_COLS, TOTAL_ITEMS } from '@claude-farmer/shared';
import type { CropSlot } from '@claude-farmer/shared';
import { fetchProfile } from '../sync/remote.js';
import { stateExists, loadState } from '../core/state.js';

const BASE_URL = 'https://claudefarmer.com';

function cropCell(slot: CropSlot | null): string {
  if (!slot) return '    ';
  const emojis = CROP_EMOJI[slot.crop];
  return ` ${emojis[slot.stage]} `;
}

export async function visitCommand(target: string): Promise<void> {
  const targetId = target.replace(/^@/, '');
  const profile = await fetchProfile(targetId);
  if (!profile) {
    console.log(chalk.red(`❌ @${targetId} not found.`));
    return;
  }

  console.log('');
  console.log(chalk.green.bold(`🌱 @${targetId}'s farm`) + chalk.dim(`  Lv.${profile.level ?? 1}`));
  console.log(chalk.dim('━'.repeat(40)));

  // 캐시된 grid 표시
  const grid = profile.farm_snapshot?.grid as (CropSlot | null)[] | undefined;
  if (grid && grid.length === 16) {
    for (let row = 0; row < GRID_COLS; row++) {
      const top = row === 0 ? '┌────┬────┬────┬────┐' : '├────┼────┼────┼────┤';
      console.log(chalk.dim(top));
      const cells = [];
      for (let col = 0; col < GRID_COLS; col++) {
        cells.push(cropCell(grid[row * GRID_COLS + col]));
      }
      console.log(chalk.dim('│') + cells.join(chalk.dim('│')) + chalk.dim('│'));
    }
    console.log(chalk.dim('└────┴────┴────┴────┘'));
  }

  if (profile.status_message?.text) {
    console.log(`💬 "${profile.status_message.text}"`);
    if (profile.status_message.link) {
      console.log(chalk.blue(`🔗 ${profile.status_message.link}`));
    }
  }

  console.log('');
  const harv = profile.total_harvests ?? 0;
  const items = profile.unique_items ?? 0;
  const streak = profile.streak_days ?? 0;
  console.log(`🪙 ${harv} harvests   📦 ${items}/${TOTAL_ITEMS}   🔥 ${streak}d`);
  console.log(chalk.dim(`👥 ${profile.total_visitors ?? 0}  💧 ${profile.total_water_received ?? 0}  🔖 ${profile.total_bookmarks ?? 0}`));

  // 방문 기록 (자기 자신이 아닐 때)
  if (stateExists()) {
    const state = await loadState();
    if (state.user.github_id !== targetId) {
      try {
        await fetch(`${BASE_URL}/api/farm/${targetId}/visit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: state.user.github_id }),
        });
      } catch { /* silent */ }
    }
  }
  console.log('');
}
