import chalk from 'chalk';

const BASE_URL = 'https://claudefarmer.com';

interface SearchResult {
  github_id: string;
  nickname: string;
  level?: number;
  total_harvests?: number;
}

export async function searchCommand(query: string): Promise<void> {
  if (!query || query.trim().length < 2) {
    console.log(chalk.yellow('Please provide a search query (min 2 chars).'));
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/explore/search?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) {
      console.log(chalk.red('❌ Search failed.'));
      return;
    }
    const results = await res.json() as SearchResult[];

    console.log('');
    console.log(chalk.bold(`🔍 Results for "${query}"`));
    console.log(chalk.dim('━'.repeat(40)));

    if (results.length === 0) {
      console.log(chalk.dim('  no farms found'));
    } else {
      results.forEach(r => {
        const lvl = r.level ? chalk.dim(` Lv.${r.level}`) : '';
        const harv = r.total_harvests != null ? chalk.dim(`  🪙 ${r.total_harvests}`) : '';
        console.log(`  @${chalk.cyan(r.github_id)}${lvl}  ${r.nickname}${harv}`);
      });
    }
    console.log('');
  } catch {
    console.log(chalk.red('❌ Network error.'));
  }
}
