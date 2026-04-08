import chalk from 'chalk';
import { stateExists, loadState, saveState } from '../core/state.js';
import { syncToServer } from '../sync/remote.js';

const BASE_URL = 'https://claudefarmer.com';

interface BookmarkOptions {
  add?: string;
  remove?: string;
  list?: boolean;
}

export async function bookmarkCommand(opts: BookmarkOptions): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('🌱 Run `claude-farmer init` first.'));
    return;
  }

  const state = await loadState();
  state.bookmarks = state.bookmarks || [];

  if (opts.list || (!opts.add && !opts.remove)) {
    console.log('');
    console.log(chalk.bold('🔖 Bookmarks'));
    console.log(chalk.dim('━'.repeat(35)));
    if (state.bookmarks.length === 0) {
      console.log(chalk.dim('  no bookmarks yet'));
    } else {
      state.bookmarks.forEach(id => console.log(`  @${id}`));
    }
    console.log('');
    return;
  }

  if (opts.add) {
    const target = opts.add.replace(/^@/, '');
    if (target === state.user.github_id) {
      console.log(chalk.red('❌ Cannot bookmark yourself.'));
      return;
    }
    if (state.bookmarks.includes(target)) {
      console.log(chalk.dim(`@${target} already bookmarked.`));
      return;
    }
    state.bookmarks.push(target);
    await saveState(state);
    let serverOk = false;
    try {
      const r = await fetch(`${BASE_URL}/api/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: target, action: 'add', from: state.user.github_id }),
      });
      serverOk = r.ok;
    } catch { /* network error */ }
    await syncToServer(state).catch(() => {});
    if (serverOk) {
      console.log(chalk.green(`✅ Bookmarked @${target}.`));
    } else {
      console.log(chalk.yellow(`⚠️  Bookmarked @${target} locally; server sync failed (will retry on next sync).`));
    }
    return;
  }

  if (opts.remove) {
    const target = opts.remove.replace(/^@/, '');
    state.bookmarks = state.bookmarks.filter(id => id !== target);
    await saveState(state);
    let serverOk = false;
    try {
      const r = await fetch(`${BASE_URL}/api/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: target, action: 'remove', from: state.user.github_id }),
      });
      serverOk = r.ok;
    } catch { /* network error */ }
    await syncToServer(state).catch(() => {});
    if (serverOk) {
      console.log(chalk.green(`✅ Removed @${target}.`));
    } else {
      console.log(chalk.yellow(`⚠️  Removed @${target} locally; server sync failed.`));
    }
  }
}
