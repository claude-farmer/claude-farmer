import chalk from 'chalk';

export async function openCommand(): Promise<void> {
  const { default: open } = await import('open');
  console.log(chalk.green('\n🌍 claudefarmer.com을 열고 있어요...\n'));
  await open('https://claudefarmer.com');
}
