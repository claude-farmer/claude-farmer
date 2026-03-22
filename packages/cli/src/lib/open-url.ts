import { execFile } from 'node:child_process';
import { platform } from 'node:process';

export function openUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (platform === 'win32') {
      // Windows: start requires shell, use cmd /c with argument separation
      execFile('cmd', ['/c', 'start', '', url], () => resolve());
    } else {
      const cmd = platform === 'darwin' ? 'open' : 'xdg-open';
      execFile(cmd, [url], () => resolve());
    }
  });
}
