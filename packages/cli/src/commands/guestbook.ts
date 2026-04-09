import chalk from 'chalk';
import * as readline from 'readline';
import { GACHA_ITEMS } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';
import { fetchGuestbook, clearGuestbook, deleteGuestbookEntry, toggleGuestbookLike } from '../sync/remote.js';
import type { GuestbookEntry } from '@claude-farmer/shared';

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

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

function confirm(question: string): Promise<boolean> {
  return prompt(question).then(a => a.toLowerCase() === 'y');
}

function printEntries(entries: GuestbookEntry[], showIndex = false) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const icon = actionIcon(entry.type);
    const action = actionLabel(entry);
    const time = timeAgo(entry.at);
    const likeTag = entry.liked ? chalk.red(' ♥') : '';
    const prefix = showIndex ? chalk.dim(`[${i + 1}] `) : '  ';
    console.log(
      `${prefix}${chalk.cyan(entry.from_nickname)} ${chalk.dim('·')} ${icon} ${chalk.dim(action)} ${chalk.dim('·')} ${chalk.dim(time)}${likeTag}`
    );
    if (entry.message) {
      const wrapped = entry.message.length > 60 ? entry.message.slice(0, 60) + '…' : entry.message;
      console.log(chalk.dim(`     └ "${wrapped}"`));
    }
  }
}

export async function guestbookCommand(
  target?: string,
  options: { clear?: boolean; delete?: boolean; like?: boolean } = {}
): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('🌱 Run `claude-farmer init` first.'));
    return;
  }
  const state = await loadState();
  const myId = state.user.github_id;

  // ── 전체 삭제 ──
  if (options.clear) {
    const yes = await confirm(chalk.yellow(`⚠️  Clear all guestbook entries for @${myId}? (y/N) `));
    if (!yes) { console.log(chalk.dim('Cancelled.')); return; }
    const ok = await clearGuestbook(myId);
    console.log(ok ? chalk.green('✅ Guestbook cleared.') : chalk.red('❌ Failed to clear guestbook.'));
    return;
  }

  // 대상 결정
  const targetId = target?.replace(/^@/, '') ?? myId;
  const isOwn = targetId === myId;

  const data = await fetchGuestbook(targetId);
  if (!data) { console.log(chalk.red('❌ Failed to fetch guestbook.')); return; }

  const entries: GuestbookEntry[] = data.entries ?? [];
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

  // ── 개별 삭제 (주인만) ──
  if (options.delete) {
    if (!isOwn) { console.log(chalk.yellow('You can only delete entries from your own guestbook.')); return; }
    printEntries(entries, true);
    console.log('');
    const input = await prompt(chalk.yellow('Enter entry number to delete (or q to cancel): '));
    if (input === 'q' || input === '') { console.log(chalk.dim('Cancelled.')); return; }
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= entries.length) { console.log(chalk.red('Invalid number.')); return; }
    const entry = entries[idx];
    const ok = await deleteGuestbookEntry(myId, entry.at, entry.from_id);
    console.log(ok ? chalk.green('✅ Entry deleted.') : chalk.red('❌ Failed to delete entry.'));
    return;
  }

  // ── 개별 좋아요 (주인만) ──
  if (options.like) {
    if (!isOwn) { console.log(chalk.yellow('You can only like entries on your own guestbook.')); return; }
    printEntries(entries, true);
    console.log('');
    const input = await prompt(chalk.yellow('Enter entry number to like/unlike (or q to cancel): '));
    if (input === 'q' || input === '') { console.log(chalk.dim('Cancelled.')); return; }
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= entries.length) { console.log(chalk.red('Invalid number.')); return; }
    const entry = entries[idx];
    const liked = await toggleGuestbookLike(myId, entry.at);
    if (liked === null) { console.log(chalk.red('❌ Failed.')); return; }
    console.log(liked ? chalk.red('♥  Liked!') : chalk.dim('♡  Unliked.'));
    return;
  }

  // ── 기본 조회 ──
  printEntries(entries);
  if (isOwn && entries.length > 0) {
    console.log('');
    console.log(chalk.dim('  --delete  개별 삭제  │  --like  개별 좋아요  │  --clear  전체 삭제'));
  }
  console.log('');
}
