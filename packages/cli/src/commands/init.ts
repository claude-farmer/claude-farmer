import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';
import { t } from '@claude-farmer/shared';
import { openUrl } from '../lib/open-url.js';
import { stateExists, ensureDataDir, saveState, createDefaultState } from '../core/state.js';
import { getLocale } from '../core/config.js';

const BASE_URL = 'https://claudefarmer.com';

interface OAuthResult {
  github_id: string;
  nickname: string;
  avatar_url: string;
}

function waitForOAuthCallback(port: number, locale: 'en' | 'ko'): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error(t(locale, 'oauthTimeout')));
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
              <h1>🌱 ${t(locale, 'oauthCallbackTitle')}</h1>
              <p>${t(locale, 'oauthCallbackBody')}</p>
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
  const locale = getLocale();

  if (stateExists()) {
    console.log(chalk.yellow(`🌱 ${t(locale, 'alreadyInit')}`));
    return;
  }

  console.log(chalk.green.bold(`\n🌱 ${t(locale, 'welcomeTitle')}\n`));
  console.log(`${t(locale, 'welcomeDesc')}\n`);

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const method = await rl.question(chalk.cyan(t(locale, 'loginMethodPrompt')));

    let githubId: string;
    let displayName: string;
    let avatarUrl: string;

    if (method.trim() === '2') {
      githubId = (await rl.question(chalk.cyan(t(locale, 'githubIdPrompt')))).trim();
      if (!githubId) {
        console.log(chalk.red(t(locale, 'githubIdRequired')));
        return;
      }
      const nickname = (await rl.question(chalk.cyan(t(locale, 'nicknamePrompt')))).trim();
      displayName = nickname || githubId;
      avatarUrl = `https://github.com/${githubId}.png`;
    } else {
      rl.close();
      const port = 19274;
      const loginUrl = `${BASE_URL}/api/auth/login?cli_port=${port}`;

      console.log(chalk.dim(`\n${t(locale, 'openingBrowser')}\n`));

      const oauthPromise = waitForOAuthCallback(port, locale);

      try {
        await openUrl(loginUrl);
      } catch {
        console.log(chalk.yellow(`${t(locale, 'browserFallback')}\n${loginUrl}\n`));
      }

      console.log(chalk.dim(`${t(locale, 'waitingOAuth')}\n`));

      try {
        const result = await oauthPromise;
        githubId = result.github_id;
        displayName = result.nickname;
        avatarUrl = result.avatar_url;
      } catch (err) {
        console.log(chalk.red(`\n${t(locale, 'oauthFailed')} ${(err as Error).message}`));
        console.log(chalk.dim(`${t(locale, 'oauthRetry')}\n`));
        return;
      }

      console.log(chalk.green(`✓ ${t(locale, 'oauthSuccess')} ${githubId}\n`));
    }

    await ensureDataDir();
    const state = createDefaultState(githubId, displayName, avatarUrl);
    await saveState(state);

    console.log(chalk.green.bold(`✅ ${t(locale, 'initDone')}`));
    console.log(`   ${t(locale, 'initNickname')} ${chalk.yellow(displayName)}`);
    console.log(`   ${t(locale, 'initFarmSize')}`);
    console.log('');
    console.log(chalk.dim(`${t(locale, 'initHint')} 🌱`));
    console.log(chalk.dim(t(locale, 'initCheck')));
    console.log(chalk.dim(t(locale, 'langHint')));
    console.log('');
  } finally {
    try { rl.close(); } catch { /* already closed */ }
  }
}
