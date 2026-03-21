import chalk from 'chalk';
import { DAILY_WATER_LIMIT } from '@claude-farmer/shared';
import { stateExists, withState, loadState } from '../core/state.js';
import { sendWater } from '../sync/remote.js';

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

  // 서버에 물 주기 전송
  const result = await sendWater(state.user.github_id, target);

  if (!result.ok) {
    if (result.error === 'User not found') {
      console.log(chalk.red(`\n앗, @${target}님을 찾을 수 없어요 🌧️\n`));
    } else if (result.error === 'Daily water limit reached') {
      console.log(chalk.yellow(`\n💧 오늘 물 주기를 다 썼어요. 내일 다시 와주세요!\n`));
    } else {
      // 서버 연결 실패 시 로컬만 업데이트
      await withState(s => {
        s.activity.today_water_given++;
        return s;
      });
      console.log(chalk.blue(`\n💧 @${target}님에게 물을 줬어요! (오프라인 모드)\n`));
    }
    return;
  }

  await withState(s => {
    s.activity.today_water_given++;
    return s;
  });

  console.log(chalk.blue(`\n💧 @${target}님에게 물을 줬어요! (남은 횟수: ${result.remaining}/${DAILY_WATER_LIMIT})\n`));
}
