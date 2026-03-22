import { Command } from 'commander';
import { t } from '@claude-farmer/shared';
import { showFarm } from './commands/farm.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { bagCommand } from './commands/bag.js';
import { openCommand } from './commands/open.js';
import { waterCommand } from './commands/water.js';
import { configCommand } from './commands/config.js';
import { stateExists, loadState } from './core/state.js';
import { getLocale } from './core/config.js';
import { startWatcher } from './detect/watcher.js';
import { syncToServer } from './sync/remote.js';

const locale = getLocale();
const program = new Command();

program
  .name('claude-farmer')
  .description('🌱 Your code grows a farm.')
  .version('0.2.0')
  .action(async () => {
    await showFarm();
    backgroundSync();
  });

program
  .command('init')
  .description(t(locale, 'descInit'))
  .action(async () => {
    await initCommand();
  });

program
  .command('status [message]')
  .description(t(locale, 'descStatus'))
  .action(async (message?: string) => {
    await statusCommand(message);
  });

program
  .command('bag')
  .description(t(locale, 'descBag'))
  .action(async () => {
    await bagCommand();
  });

program
  .command('open')
  .description(t(locale, 'descOpen'))
  .action(async () => {
    await openCommand();
  });

program
  .command('water <user>')
  .description(t(locale, 'descWater'))
  .action(async (user: string) => {
    await waterCommand(user);
  });

program
  .command('watch')
  .description(t(locale, 'descWatch'))
  .action(() => {
    if (!stateExists()) {
      console.log(`🌱 ${t(locale, 'initFirst')}`);
      return;
    }
    console.log(`🌱 ${t(locale, 'watchDetecting')}`);
    startWatcher();
  });

program
  .command('config')
  .description(t(locale, 'descConfig'))
  .option('--lang <locale>', 'Set language (en, ko)')
  .action(async (options: { lang?: string }) => {
    await configCommand(options);
  });

program.parse();

function backgroundSync() {
  if (!stateExists()) return;
  loadState()
    .then(state => syncToServer(state))
    .catch(() => {});
}
