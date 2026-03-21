#!/usr/bin/env node

import { Command } from 'commander';
import { showFarm } from './commands/farm.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { bagCommand } from './commands/bag.js';
import { openCommand } from './commands/open.js';
import { waterCommand } from './commands/water.js';
import { stateExists, loadState } from './core/state.js';
import { startWatcher } from './detect/watcher.js';
import { syncToServer } from './sync/remote.js';

const program = new Command();

program
  .name('claude-farmer')
  .description('🌱 Your code grows a farm.')
  .version('0.0.1')
  .action(async () => {
    await showFarm();
    backgroundSync();
  });

program
  .command('init')
  .description('초기화 (GitHub 로그인 + 닉네임 설정)')
  .action(async () => {
    await initCommand();
  });

program
  .command('status [message]')
  .description('말풍선 상태 메세지 설정')
  .action(async (message?: string) => {
    await statusCommand(message);
  });

program
  .command('bag')
  .description('도감 (수집한 아이템 목록)')
  .action(async () => {
    await bagCommand();
  });

program
  .command('open')
  .description('웹 UI 브라우저에서 열기')
  .action(async () => {
    await openCommand();
  });

program
  .command('water <user>')
  .description('다른 유저에게 물 주기')
  .action(async (user: string) => {
    await waterCommand(user);
  });

program
  .command('watch')
  .description('Claude Code 감지 모드 (백그라운드)')
  .action(() => {
    if (!stateExists()) {
      console.log('🌱 먼저 `claude-farmer init`으로 시작해주세요.');
      return;
    }
    console.log('🌱 Claude Code 활동을 감지하고 있어요... (Ctrl+C로 종료)');
    startWatcher();
  });

program.parse();

// 커맨드 실행 후 백그라운드 동기화
function backgroundSync() {
  if (!stateExists()) return;
  loadState()
    .then(state => syncToServer(state))
    .catch(() => {});
}
