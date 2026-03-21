import chalk from 'chalk';
import {
  CROP_EMOJI, CROP_NAME_KO, RARITY_LABEL,
  getTimeOfDay, TIME_GREETING, TIME_EMOJI,
  TOTAL_ITEMS,
} from '@claude-farmer/shared';
import type { CropSlot } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';

function cropCell(slot: CropSlot | null): string {
  if (!slot) return '    ';
  const emojis = CROP_EMOJI[slot.crop];
  const emoji = emojis[slot.stage];
  return ` ${emoji} `;
}

export async function showFarm(): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('\n🌱 아직 농장이 없어요! `claude-farmer init`으로 시작해보세요.\n'));
    return;
  }

  const state = await loadState();
  const { farm, user, status_message, inventory, activity } = state;
  const hour = new Date().getHours();
  const tod = getTimeOfDay(hour);
  const greeting = TIME_GREETING[tod];
  const emoji = TIME_EMOJI[tod];

  const uniqueItems = new Set(inventory.map(i => i.id)).size;

  console.log('');
  console.log(
    `${chalk.green.bold(`🌱 @${user.nickname}의 농장`)} ${chalk.dim(`(Lv.${farm.level})`)}          ${emoji} ${greeting}`
  );
  console.log(chalk.dim('━'.repeat(40)));

  // 4×4 그리드
  const g = farm.grid;
  for (let row = 0; row < 4; row++) {
    const top = row === 0 ? '┌────┬────┬────┬────┐' : '├────┼────┼────┼────┤';
    console.log(chalk.dim(top));
    const cells = [];
    for (let col = 0; col < 4; col++) {
      cells.push(cropCell(g[row * 4 + col]));
    }
    console.log(chalk.dim('│') + cells.join(chalk.dim('│')) + chalk.dim('│'));
  }
  console.log(chalk.dim('└────┴────┴────┴────┘'));

  if (status_message?.text) {
    console.log(`💬 "${status_message.text}"`);
  }

  console.log('');
  console.log(`📦 도감: ${uniqueItems}/${TOTAL_ITEMS} (${Math.round(uniqueItems / TOTAL_ITEMS * 100)}%)  🪙 수확: ${farm.total_harvests}회`);
  console.log(`💧 오늘 받은 물: ${activity.today_water_received}회  🔥 연속: ${activity.streak_days}일`);
  console.log('');
}
