import chalk from 'chalk';
import { t } from '@claude-farmer/shared';
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

  const result = await sendWater((await loadState()).user.github_id, target);

  if (!result.ok) {
    if (result.error === 'User not found') {
      console.log(chalk.red(`\n${t(locale, 'waterUserNotFound', { target })}\n`));
    } else if (result.error === 'Water on cooldown') {
      const mins = Math.ceil((result.cooldown_remaining ?? 300) / 60);
      console.log(chalk.yellow(`\n💧 ${t(locale, 'waterCooldown', { minutes: String(mins) })}\n`));
    } else if (result.error === 'Network error') {
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

  console.log(chalk.blue(`\n💧 ${t(locale, 'waterSent', { target })}\n`));
}
