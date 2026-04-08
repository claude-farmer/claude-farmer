import chalk from 'chalk';
import { GACHA_ITEMS } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';
import { fetchGuestbook } from '../sync/remote.js';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function actionLabel(entry: { type: string; item_id?: string }): string {
  if (entry.type === 'gift' && entry.item_id) {
    const item = GACHA_ITEMS.find(i => i.id === entry.item_id);
    return `gifted ${item?.name ?? entry.item_id}`;
  }
  if (entry.type === 'water') return 'watered';
  if (entry.type === 'gift') return 'gifted';
  return 'visited';
}

function actionIcon(type: string): string {
  if (type === 'water') return '💧';
  if (type === 'gift') return '🎁';
  return '👣';
}

export async function guestbookCommand(target?: string): Promise<void> {
  let targetId = target?.replace(/^@/, '');
  if (!targetId) {
    if (!stateExists()) {
      console.log(chalk.yellow('🌱 Run `claude-farmer init` first.'));
      return;
    }
    const state = await loadState();
    targetId = state.user.github_id;
  }

  const data = await fetchGuestbook(targetId);
  if (!data) {
    console.log(chalk.red('❌ Failed to fetch guestbook.'));
    return;
  }

  const entries = data.entries ?? [];
  const totalWater = data.total_water_received ?? 0;
  const totalGifts = data.total_gifts_received ?? 0;

  console.log('');
  console.log(chalk.green.bold(`✍️  @${targetId}'s guestbook`) + chalk.dim(`  ·  💧 ${totalWater}  🎁 ${totalGifts}`));
  console.log(chalk.dim('━'.repeat(50)));

  if (entries.length === 0) {
    console.log(chalk.dim('  no entries yet'));
    console.log('');
    return;
  }

  for (const entry of entries) {
    const icon = actionIcon(entry.type);
    const action = actionLabel(entry);
    const time = timeAgo(entry.at);
    console.log(
      `  ${chalk.cyan(entry.from_nickname)} ${chalk.dim('·')} ${icon} ${chalk.dim(action)} ${chalk.dim('·')} ${chalk.dim(time)}`
    );
    if (entry.message) {
      const wrapped = entry.message.length > 60 ? entry.message.slice(0, 60) + '…' : entry.message;
      console.log(chalk.dim(`     └ "${wrapped}"`));
    }
    if (entry.link) {
      console.log(chalk.blue(`       ${entry.link}`));
    }
  }
  console.log('');
}
