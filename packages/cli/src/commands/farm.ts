import chalk from 'chalk';
import {
  CROP_EMOJI, getTimeOfDay, TIME_EMOJI, TOTAL_ITEMS, t, getTimeGreeting,
} from '@claude-farmer/shared';
import type { CropSlot } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';
import { getLocale } from '../core/config.js';
import { showNotifications } from './notifications.js';

function cropCell(slot: CropSlot | null): string {
  if (!slot) return '    ';
  const emojis = CROP_EMOJI[slot.crop];
  const emoji = emojis[slot.stage];
  return ` ${emoji} `;
}

export async function showFarm(): Promise<void> {
  const locale = getLocale();

  if (!stateExists()) {
    console.log(chalk.yellow(`\n🌱 ${t(locale, 'noFarm')}\n`));
    return;
  }

  const state = await loadState();
  const { farm, user, status_message, inventory, activity } = state;
  const hour = new Date().getHours();
  const tod = getTimeOfDay(hour);
  const greeting = getTimeGreeting(locale, tod);
  const emoji = TIME_EMOJI[tod];

  const uniqueItems = new Set(inventory.map(i => i.id)).size;

  console.log('');
  console.log(
    `${chalk.green.bold(`🌱 @${user.nickname}${t(locale, 'farmOf')}`)} ${chalk.dim(`(Lv.${farm.level})`)}          ${emoji} ${greeting}`
  );
  console.log(chalk.dim('━'.repeat(40)));

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
  console.log(`📦 ${t(locale, 'collection')} ${uniqueItems}/${TOTAL_ITEMS} (${Math.round(uniqueItems / TOTAL_ITEMS * 100)}%)  🪙 ${farm.total_harvests}${t(locale, 'harvests')}`);
  console.log(`💧 ${t(locale, 'waterReceived')} ${activity.today_water_received}  🔥 ${t(locale, 'streak')} ${activity.streak_days}${t(locale, 'days')}`);
  console.log('');

  // 서버에서 소셜 알림 조회 (실패해도 무시)
  await showNotifications(user.github_id, locale).catch(() => {});
}
