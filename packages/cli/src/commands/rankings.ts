import chalk from 'chalk';
import { stateExists, loadState } from '../core/state.js';
import { fetchRankings } from '../sync/remote.js';

interface RankingEntry {
  github_id: string;
  nickname: string;
  count: number;
}

function trophy(rank: number): string {
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return `${rank + 1}.`;
}

function renderList(title: string, list: RankingEntry[], icon: string) {
  console.log('');
  console.log(chalk.bold(`${icon} ${title}`));
  console.log(chalk.dim('━'.repeat(40)));
  if (list.length === 0) {
    console.log(chalk.dim('  no records yet'));
    return;
  }
  list.forEach((e, i) => {
    const t = trophy(i);
    const colorFn = i === 0 ? chalk.yellow : i === 1 ? chalk.gray : i === 2 ? chalk.hex('#cd7f32') : chalk.dim;
    const name = e.nickname.length > 20 ? e.nickname.slice(0, 19) + '…' : e.nickname.padEnd(20);
    console.log(`  ${t} ${colorFn(name)} ${chalk.dim(`× ${e.count}`)}`);
  });
}

export async function rankingsCommand(target?: string): Promise<void> {
  let targetId = target?.replace(/^@/, '');
  if (!targetId) {
    if (!stateExists()) {
      console.log(chalk.yellow('🌱 Run `claude-farmer init` first.'));
      return;
    }
    const state = await loadState();
    targetId = state.user.github_id;
  }

  const data = await fetchRankings(targetId);
  if (!data) {
    console.log(chalk.red('❌ Failed to fetch rankings.'));
    return;
  }

  console.log(chalk.green.bold(`\n🏆 @${targetId}'s thank-you wall`));

  renderList('Water', data.water ?? [], '💧');
  renderList('Gifts', data.gifts ?? [], '🎁');
  console.log('');
}
