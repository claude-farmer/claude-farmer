import chalk from 'chalk';
import {
  CROP_EMOJI, getTimeOfDay, TIME_EMOJI, TOTAL_ITEMS, t, getTimeGreeting,
  GRID_COLS,
} from '@claude-farmer/shared';
import type { CropSlot } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';
import { getLocale } from '../core/config.js';
import { showNotifications } from './notifications.js';
import { fetchProfile } from '../sync/remote.js';

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
  for (let row = 0; row < GRID_COLS; row++) {
    const top = row === 0 ? '┌────┬────┬────┬────┐' : '├────┼────┼────┼────┤';
    console.log(chalk.dim(top));
    const cells = [];
    for (let col = 0; col < GRID_COLS; col++) {
      cells.push(cropCell(g[row * GRID_COLS + col]));
    }
    console.log(chalk.dim('│') + cells.join(chalk.dim('│')) + chalk.dim('│'));
  }
  console.log(chalk.dim('└────┴────┴────┴────┘'));

  if (status_message?.text) {
    console.log(`💬 "${status_message.text}"`);
    if (status_message.link) {
      console.log(chalk.blue(`🔗 ${status_message.link}`));
    }
  }

  console.log('');
  console.log(`📦 ${t(locale, 'collection')} ${uniqueItems}/${TOTAL_ITEMS} (${Math.round(uniqueItems / TOTAL_ITEMS * 100)}%)  🪙 ${farm.total_harvests}${t(locale, 'harvests')}`);
  console.log(`💧 ${t(locale, 'waterReceived')} ${activity.today_water_received}  🔥 ${t(locale, 'streak')} ${activity.streak_days}${t(locale, 'days')}`);

  // Today: 활동 있을 때만
  if (activity.today_input_chars > 0 || activity.today_harvests > 0 || activity.today_water_given > 0) {
    const k = (activity.today_input_chars / 1000).toFixed(1);
    console.log(chalk.dim(`📅 today  ⌨ ${k}k  🌱 ${activity.today_harvests}  💧 ${activity.today_water_given}`));
  }

  // 서버 누적 카운터 (실패해도 무시)
  const remote = await fetchProfile(user.github_id).catch(() => null);
  if (remote) {
    const visitors = remote.total_visitors ?? 0;
    const totalWater = remote.total_water_received ?? 0;
    const bookmarks = remote.total_bookmarks ?? 0;
    if (visitors > 0 || totalWater > 0 || bookmarks > 0) {
      console.log(chalk.dim(`👥 ${visitors}  💧 ${totalWater}  🔖 ${bookmarks}`));
    }
  }
  console.log('');

  // 서버에서 소셜 알림 조회 (실패해도 무시)
  await showNotifications(user.github_id, locale).catch(() => {});
}
