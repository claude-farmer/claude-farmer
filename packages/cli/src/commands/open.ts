import chalk from 'chalk';
import { openUrl } from '../lib/open-url.js';

export async function openCommand(): Promise<void> {
  console.log(chalk.green('\n🌍 claudefarmer.com을 열고 있어요...\n'));
  await openUrl('https://claudefarmer.com');
}
