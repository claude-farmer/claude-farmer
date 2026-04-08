import chalk from 'chalk';
import { GACHA_ITEMS } from '@claude-farmer/shared';
import { stateExists, loadState, saveState } from '../core/state.js';
import { sendGift, fetchProfile } from '../sync/remote.js';

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
  if (!state.inventory.some(i => i.id === itemId)) {
    console.log(chalk.red(`❌ You don't own item "${itemId}".`));
    console.log(chalk.dim('   Run `claude-farmer bag` to see your collection.'));
    return;
  }

  const item = GACHA_ITEMS.find(i => i.id === itemId);
  const itemName = item?.name ?? itemId;

  console.log(chalk.dim(`🎁 Sending ${itemName} to @${toId}...`));
  const result = await sendGift(toId, itemId, fromId);

  if (result.ok) {
    // 서버는 이미 inventory를 감산했음. 로컬을 서버 상태로 refetch (full state push 방지)
    const remote = await fetchProfile(fromId).catch(() => null);
    if (remote?.inventory) {
      state.inventory = remote.inventory;
    } else {
      // refetch 실패 시 로컬에서 itemId로 첫 매칭 항목 1개 제거 (stale index 방지)
      const freshIdx = state.inventory.findIndex(i => i.id === itemId);
      if (freshIdx >= 0) state.inventory.splice(freshIdx, 1);
    }
    await saveState(state);
    console.log(chalk.green(`✅ Gift sent! @${toId} received your ${itemName}.`));
  } else {
    const err = String(result.error ?? '');
    if (err.includes('Too fast')) {
      console.log(chalk.yellow('⏳ Slow down — wait a few seconds before gifting again.'));
    } else if (err.includes('not found') || err.includes('User not found')) {
      console.log(chalk.red(`❌ User @${toId} not found.`));
    } else if (err.includes('not in inventory')) {
      console.log(chalk.red(`❌ Server says you don't own "${itemId}". Try syncing with \`claude-farmer farm\` first.`));
    } else if (err.includes('Unauthorized')) {
      console.log(chalk.red('❌ Authentication failed. Try `claude-farmer init` again.'));
    } else {
      console.log(chalk.red(`❌ ${err || 'Failed to send gift.'}`));
    }
  }
}
