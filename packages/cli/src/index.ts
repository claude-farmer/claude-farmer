#!/usr/bin/env node

import { Command } from 'commander';
import { showFarm } from './commands/farm.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { bagCommand } from './commands/bag.js';
import { openCommand } from './commands/open.js';
import { waterCommand } from './commands/water.js';

const program = new Command();

program
  .name('claude-farmer')
  .description('🌱 Your code grows a farm.')
  .version('0.0.1')
  .action(async () => {
    await showFarm();
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

program.parse();
