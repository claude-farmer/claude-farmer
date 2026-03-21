import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';
import { openUrl } from '../lib/open-url.js';
import { stateExists, ensureDataDir, saveState, createDefaultState } from '../core/state.js';

const BASE_URL = 'https://claudefarmer.com';

interface OAuthResult {
  github_id: string;
  nickname: string;
  avatar_url: string;
}

function waitForOAuthCallback(port: number): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth 시간 초과 (2분)'));
    }, 120_000);

    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);
      if (url.pathname === '/callback') {
        const github_id = url.searchParams.get('github_id') || '';
        const nickname = url.searchParams.get('nickname') || github_id;
        const avatar_url = url.searchParams.get('avatar_url') || `https://github.com/${github_id}.png`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><body style="background:#1a1d27;color:#e5e7eb;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="text-align:center">
              <h1>🌱 인증 완료!</h1>
              <p>터미널로 돌아가세요. 이 창은 닫아도 됩니다.</p>
            </div>
          </body></html>
        `);

        clearTimeout(timeout);
        server.close();
        resolve({ github_id, nickname, avatar_url });
      }
    });

    server.listen(port, () => {});
    server.on('error', reject);
  });
}

export async function initCommand(): Promise<void> {
  if (stateExists()) {
    console.log(chalk.yellow('🌱 이미 초기화되어 있어요! `claude-farmer`로 농장을 확인해보세요.'));
    return;
  }

  console.log(chalk.green.bold('\n🌱 Claude Farmer에 오신 걸 환영해요!\n'));
  console.log('코딩하면 농장이 자동으로 자라는 방치형 게임이에요.\n');

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const method = await rl.question(chalk.cyan('로그인 방법 선택 [1] GitHub 로그인 (추천)  [2] 수동 입력: '));

    let githubId: string;
    let displayName: string;
    let avatarUrl: string;

    if (method.trim() === '2') {
      // 수동 입력
      githubId = (await rl.question(chalk.cyan('GitHub 아이디: '))).trim();
      if (!githubId) {
        console.log(chalk.red('앗, GitHub 아이디를 입력해주세요!'));
        return;
      }
      const nickname = (await rl.question(chalk.cyan('닉네임 (농장에 표시돼요): '))).trim();
      displayName = nickname || githubId;
      avatarUrl = `https://github.com/${githubId}.png`;
    } else {
      // GitHub OAuth
      rl.close();
      const port = 19274;
      const loginUrl = `${BASE_URL}/api/auth/login?cli_port=${port}`;

      console.log(chalk.dim('\n브라우저에서 GitHub 로그인 페이지를 여는 중...\n'));

      const oauthPromise = waitForOAuthCallback(port);

      try {
        await openUrl(loginUrl);
      } catch {
        console.log(chalk.yellow(`브라우저가 열리지 않으면 직접 열어주세요:\n${loginUrl}\n`));
      }

      console.log(chalk.dim('GitHub 로그인을 완료하면 자동으로 진행됩니다...\n'));

      try {
        const result = await oauthPromise;
        githubId = result.github_id;
        displayName = result.nickname;
        avatarUrl = result.avatar_url;
      } catch (err) {
        console.log(chalk.red(`\n인증 실패: ${(err as Error).message}`));
        console.log(chalk.dim('`claude-farmer init`으로 다시 시도해보세요.\n'));
        return;
      }

      console.log(chalk.green(`✓ GitHub 로그인 성공: ${githubId}\n`));
    }

    await ensureDataDir();
    const state = createDefaultState(githubId, displayName, avatarUrl);
    await saveState(state);

    console.log(chalk.green.bold('✅ 초기화 완료!'));
    console.log(`   닉네임: ${chalk.yellow(displayName)}`);
    console.log(`   농장 크기: 4×4 (16칸)`);
    console.log('');
    console.log(chalk.dim('Claude Code를 사용하면 자동으로 농장이 자라요 🌱'));
    console.log(chalk.dim('`claude-farmer`로 농장을 확인해보세요!\n'));
  } finally {
    try { rl.close(); } catch { /* already closed */ }
  }
}
