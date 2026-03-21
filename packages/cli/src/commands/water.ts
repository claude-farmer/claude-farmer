import chalk from 'chalk';
import { DAILY_WATER_LIMIT } from '@claude-farmer/shared';
import { stateExists, withState, loadState } from '../core/state.js';

export async function waterCommand(user: string): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('\n🌱 먼저 `claude-farmer init`으로 시작해주세요.\n'));
    return;
  }

  const target = user.replace(/^@/, '');
  const state = await loadState();

  if (state.activity.today_water_given >= DAILY_WATER_LIMIT) {
    console.log(chalk.yellow(`\n💧 오늘 물 주기를 다 썼어요 (${DAILY_WATER_LIMIT}/${DAILY_WATER_LIMIT}). 내일 다시 와주세요!\n`));
    return;
  }

  // TODO: Upstash Redis로 실제 물 주기 전송
  await withState(s => {
    s.activity.today_water_given++;
    return s;
  });

  const remaining = DAILY_WATER_LIMIT - state.activity.today_water_given - 1;
  console.log(chalk.blue(`\n💧 @${target}님에게 물을 줬어요! (남은 횟수: ${remaining}/${DAILY_WATER_LIMIT})\n`));
}
