import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { type Locale, detectLocale, DATA_DIR } from '@claude-farmer/shared';
import { ensureDataDir } from './state.js';

interface CliConfig {
  lang?: Locale;
}

const configPath = join(homedir(), DATA_DIR, 'config.json');

function loadConfig(): CliConfig {
  try {
    if (!existsSync(configPath)) return {};
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config: CliConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function getLocale(): Locale {
  const config = loadConfig();
  if (config.lang) return config.lang;
  // Auto-detect from environment
  const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '';
  return detectLocale(envLang);
}

export async function setLocale(lang: Locale): Promise<void> {
  await ensureDataDir();
  const config = loadConfig();
  config.lang = lang;
  saveConfig(config);
}

export function getConfig(): CliConfig {
  return loadConfig();
}
