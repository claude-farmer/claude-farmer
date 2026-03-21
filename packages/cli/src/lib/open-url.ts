import { exec } from 'node:child_process';
import { platform } from 'node:process';

export function openUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} "${url}"`, () => resolve());
  });
}
