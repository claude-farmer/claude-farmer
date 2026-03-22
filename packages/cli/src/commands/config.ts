import chalk from 'chalk';
import { type Locale, t } from '@claude-farmer/shared';
import { getLocale, setLocale } from '../core/config.js';

export async function configCommand(options: { lang?: string }): Promise<void> {
  const locale = getLocale();

  if (options.lang) {
    const lang = options.lang.toLowerCase();
    if (lang !== 'en' && lang !== 'ko') {
      console.log(chalk.red('\nSupported languages: en, ko\n'));
      return;
    }
    await setLocale(lang as Locale);
    console.log(chalk.green(`\n✅ ${t(lang as Locale, 'configLangSet', { lang })}\n`));
    return;
  }

  // Show current config
  console.log(`\n${t(locale, 'configCurrent')}`);
  console.log(`  ${t(locale, 'configLang')} ${locale}`);
  console.log('');
  console.log(chalk.dim(t(locale, 'configHelp')));
  console.log('');
}
