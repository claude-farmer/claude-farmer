import chalk from 'chalk';
import { t } from '@claude-farmer/shared';
import { stateExists, withState, loadState } from '../core/state.js';
import { getLocale } from '../core/config.js';

export async function statusCommand(message?: string): Promise<void> {
  const locale = getLocale();

  if (!stateExists()) {
    console.log(chalk.yellow(`\n🌱 ${t(locale, 'initFirst')}\n`));
    return;
  }

  if (!message) {
    const state = await loadState();
    if (state.status_message?.text) {
      console.log(`\n💬 ${t(locale, 'currentStatus')} "${state.status_message.text}"`);
      if (state.status_message.link) {
        console.log(`🔗 ${state.status_message.link}`);
      }
    } else {
      console.log(chalk.dim(`\n💬 ${t(locale, 'statusEmpty')}`));
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

  console.log(`\n💬 ${t(locale, 'statusSet')} "${chalk.yellow(message)}"\n`);
}
