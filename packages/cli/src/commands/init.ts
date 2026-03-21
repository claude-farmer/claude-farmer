import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';
import { stateExists, ensureDataDir, saveState, createDefaultState } from '../core/state.js';

export async function initCommand(): Promise<void> {
  if (stateExists()) {
    console.log(chalk.yellow('🌱 이미 초기화되어 있어요! `claude-farmer`로 농장을 확인해보세요.'));
    return;
  }

  console.log(chalk.green.bold('\n🌱 Claude Farmer에 오신 걸 환영해요!\n'));
  console.log('코딩하면 농장이 자동으로 자라는 방치형 게임이에요.\n');

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // TODO: GitHub OAuth 연동 (지금은 수동 입력)
    const githubId = await rl.question(chalk.cyan('GitHub 아이디: '));
    if (!githubId.trim()) {
      console.log(chalk.red('앗, GitHub 아이디를 입력해주세요!'));
      return;
    }

    const nickname = await rl.question(chalk.cyan('닉네임 (농장에 표시돼요): '));
    const displayName = nickname.trim() || githubId.trim();

    await ensureDataDir();
    const state = createDefaultState(
      githubId.trim(),
      displayName,
      `https://github.com/${githubId.trim()}.png`,
    );
    await saveState(state);

    console.log('');
    console.log(chalk.green.bold('✅ 초기화 완료!'));
    console.log(`   닉네임: ${chalk.yellow(displayName)}`);
    console.log(`   농장 크기: 4×4 (16칸)`);
    console.log('');
    console.log(chalk.dim('Claude Code를 사용하면 자동으로 농장이 자라요 🌱'));
    console.log(chalk.dim('`claude-farmer`로 농장을 확인해보세요!\n'));
  } finally {
    rl.close();
  }
}
