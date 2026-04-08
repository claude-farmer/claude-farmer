import { Command } from 'commander';
import { t } from '@claude-farmer/shared';
import { showFarm } from './commands/farm.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { bagCommand } from './commands/bag.js';
import { openCommand } from './commands/open.js';
import { waterCommand } from './commands/water.js';
import { configCommand } from './commands/config.js';
import { guestbookCommand } from './commands/guestbook.js';
import { rankingsCommand } from './commands/rankings.js';
import { giftCommand } from './commands/gift.js';
import { characterCommand } from './commands/character.js';
import { bookmarkCommand } from './commands/bookmark.js';
import { searchCommand } from './commands/search.js';
import { visitCommand } from './commands/visit.js';
import { stateExists, loadState } from './core/state.js';
import { getLocale } from './core/config.js';
import { startWatcher } from './detect/watcher.js';
import { syncToServer } from './sync/remote.js';

const locale = getLocale();
const program = new Command();

program
  .name('claude-farmer')
  .description('🌱 Your code grows a farm.')
  .version('0.3.3')
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
  .option('--link <url>', 'Optional link attached to your status')
  .option('--clear', 'Clear your current status')
  .action(async (message: string | undefined, opts: { link?: string; clear?: boolean }) => {
    await statusCommand(message, opts);
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
  .command('guestbook [user]')
  .description('Show a farm guestbook (default: yours)')
  .action(async (user?: string) => {
    await guestbookCommand(user);
  });

program
  .command('rankings [user]')
  .description('Show top water/gift contributors for a farm (default: yours)')
  .action(async (user?: string) => {
    await rankingsCommand(user);
  });

program
  .command('gift <user> <itemId>')
  .description('Gift a gacha item from your inventory to another farm')
  .action(async (user: string, itemId: string) => {
    await giftCommand(user, itemId);
  });

program
  .command('character')
  .description('View or update your character (use --show or pass flags)')
  .option('--show', 'Show current character')
  .option('--random', 'Randomize character')
  .option('--type <type>', 'Character type (human, bear, rabbit, ...)')
  .option('--hairStyle <style>', 'Hair style (human only)')
  .option('--hairColor <color>', 'Hair color')
  .option('--skinTone <tone>', 'Skin tone (human only)')
  .option('--eyeStyle <style>', 'Eye style (dot, round, line, star, closed)')
  .option('--accessory <acc>', 'Accessory (none, glasses, sunglasses, eyepatch, bandaid)')
  .option('--clothesColor <color>', 'Clothes color')
  .action(async (opts) => {
    await characterCommand(opts);
  });

program
  .command('visit <user>')
  .description('Visit another developer\'s farm')
  .action(async (user: string) => {
    await visitCommand(user);
  });

program
  .command('search <query>')
  .description('Search farms by GitHub ID or nickname')
  .action(async (query: string) => {
    await searchCommand(query);
  });

program
  .command('bookmark')
  .description('Manage your bookmarks (--add @user, --remove @user, --list)')
  .option('--add <user>', 'Bookmark a user')
  .option('--remove <user>', 'Remove a bookmark')
  .option('--list', 'List all bookmarks')
  .action(async (opts) => {
    await bookmarkCommand(opts);
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
