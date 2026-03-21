import chalk from 'chalk';
import { stateExists, withState } from '../core/state.js';

export async function statusCommand(message?: string): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('\n🌱 먼저 `claude-farmer init`으로 시작해주세요.\n'));
    return;
  }

  if (!message) {
    // 현재 상태 메세지 보여주기
    const { withState: _ } = await import('../core/state.js');
    const state = await (await import('../core/state.js')).loadState();
    if (state.status_message?.text) {
      console.log(`\n💬 현재 말풍선: "${state.status_message.text}"`);
      if (state.status_message.link) {
        console.log(`🔗 ${state.status_message.link}`);
      }
    } else {
      console.log(chalk.dim('\n💬 말풍선이 비어있어요. `claude-farmer status "메세지"` 로 설정해보세요!'));
    }
    console.log('');
    return;
  }

  await withState(state => {
    state.status_message = {
      text: message,
      updated_at: new Date().toISOString(),
    };
    return state;
  });

  console.log(`\n💬 말풍선 설정: "${chalk.yellow(message)}"\n`);
}
