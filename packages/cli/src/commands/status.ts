import chalk from 'chalk';
import { t } from '@claude-farmer/shared';
import { stateExists, withState, loadState } from '../core/state.js';
import { getLocale } from '../core/config.js';
import { updateStatusRemote } from '../sync/remote.js';

export async function statusCommand(message?: string, opts?: { link?: string; clear?: boolean }): Promise<void> {
  const locale = getLocale();

  if (!stateExists()) {
    console.log(chalk.yellow(`\n🌱 ${t(locale, 'initFirst')}\n`));
    return;
  }

  if (opts?.clear) {
    const state = await withState(state => {
      state.status_message = null;
      return state;
    });
    await updateStatusRemote(state.user.github_id, null).catch(() => {});
    console.log(chalk.dim('\n💬 Status cleared.\n'));
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

  // 서버 한계: text 200자, link 500자
  const trimmedText = message.length > 200 ? message.slice(0, 200) : message;
  // Link normalization: 웹과 일관 — 사용자가 scheme 없이 입력하면 https:// 자동 prefix
  const rawLink = opts?.link?.trim();
  const normalizedLink = rawLink
    ? (/^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`)
    : undefined;
  const trimmedLink = normalizedLink ? normalizedLink.slice(0, 500) : undefined;
  if (message.length > 200) {
    console.log(chalk.yellow(`⚠️  Status text truncated to 200 chars (was ${message.length}).`));
  }
  if ((opts?.link?.trim().length ?? 0) > 500) {
    console.log(chalk.yellow(`⚠️  Link truncated to 500 chars.`));
  }

  const state = await withState(state => {
    state.status_message = {
      text: trimmedText,
      link: trimmedLink,
      updated_at: new Date().toISOString(),
    };
    return state;
  });
  await updateStatusRemote(state.user.github_id, state.status_message).catch(() => {});

  console.log(`\n💬 ${t(locale, 'statusSet')} "${chalk.yellow(trimmedText)}"`);
  if (trimmedLink) console.log(`🔗 ${trimmedLink}`);
  console.log('');
}
