import chalk from 'chalk';
import { DAILY_WATER_LIMIT, t } from '@claude-farmer/shared';
import { stateExists, withState, loadState } from '../core/state.js';
import { sendWater } from '../sync/remote.js';
import { getLocale } from '../core/config.js';

export async function waterCommand(user: string): Promise<void> {
  const locale = getLocale();

  if (!stateExists()) {
    console.log(chalk.yellow(`\n🌱 ${t(locale, 'initFirst')}\n`));
    return;
  }

  const target = user.replace(/^@/, '');
  const state = await loadState();

  if (state.activity.today_water_given >= DAILY_WATER_LIMIT) {
    console.log(chalk.yellow(`\n💧 ${t(locale, 'waterLimitReached')}\n`));
    return;
  }

  const result = await sendWater(state.user.github_id, target);

  if (!result.ok) {
    if (result.error === 'User not found') {
      console.log(chalk.red(`\n${t(locale, 'waterUserNotFound', { target })}\n`));
    } else if (result.error === 'Daily water limit reached') {
      console.log(chalk.yellow(`\n💧 ${t(locale, 'waterServerLimit')}\n`));
    } else if (result.error === 'Network error') {
      // Only accept offline mode for actual network failures
      console.log(chalk.dim(`\n💧 ${t(locale, 'waterSentOffline', { target })}\n`));
    } else {
      console.log(chalk.red(`\n❌ ${result.error || 'Unknown error'}\n`));
    }
    return;
  }

  await withState(s => {
    s.activity.today_water_given++;
    return s;
  });

  console.log(chalk.blue(`\n💧 ${t(locale, 'waterSent', { target, remaining: String(result.remaining), limit: String(DAILY_WATER_LIMIT) })}\n`));
}
