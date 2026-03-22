import chalk from 'chalk';
import { t } from '@claude-farmer/shared';
import { openUrl } from '../lib/open-url.js';
import { getLocale } from '../core/config.js';

export async function openCommand(): Promise<void> {
  const locale = getLocale();
  console.log(chalk.green(`\n🌍 ${t(locale, 'openingWeb')}\n`));
  await openUrl('https://claudefarmer.com');
}
