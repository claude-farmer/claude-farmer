import chalk from 'chalk';
import { GACHA_ITEMS } from '@claude-farmer/shared';
import { stateExists, loadState } from '../core/state.js';
import { sendGift } from '../sync/remote.js';

export async function giftCommand(targetUser: string, itemId: string): Promise<void> {
  if (!stateExists()) {
    console.log(chalk.yellow('🌱 Run `claude-farmer init` first.'));
    return;
  }

  const state = await loadState();
  const fromId = state.user.github_id;
  const toId = targetUser.replace(/^@/, '');

  if (toId === fromId) {
    console.log(chalk.red('❌ Cannot gift yourself.'));
    return;
  }

  // 인벤토리 검증
  const owned = state.inventory.find(i => i.id === itemId);
  if (!owned) {
    console.log(chalk.red(`❌ You don't own item "${itemId}".`));
    console.log(chalk.dim('   Run `claude-farmer bag` to see your collection.'));
    return;
  }

  const item = GACHA_ITEMS.find(i => i.id === itemId);
  const itemName = item?.name ?? itemId;

  console.log(chalk.dim(`🎁 Sending ${itemName} to @${toId}...`));
  const result = await sendGift(toId, itemId, fromId);

  if (result.ok) {
    console.log(chalk.green(`✅ Gift sent! @${toId} received your ${itemName}.`));
  } else {
    console.log(chalk.red(`❌ ${result.error ?? 'Failed to send gift.'}`));
  }
}
