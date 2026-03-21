import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import chalk from 'chalk';
import { CROP_NAME_KO, RARITY_LABEL } from '@claude-farmer/shared';
import type { LocalState } from '@claude-farmer/shared';
import { withState, stateExists } from '../core/state.js';
import { plantCrop, growCrops, autoHarvest } from '../core/farm.js';

// Claude Code의 로컬 데이터 경로 (대화 히스토리)
const CLAUDE_DIR = join(homedir(), '.claude');

let turnCount = 0;
let lastActivityTime = 0;

function notify(msg: string): void {
  console.log(msg);
}

async function onClaudeActivity(): Promise<void> {
  if (!stateExists()) return;

  const now = Date.now();
  // 최소 5초 간격으로 감지 (중복 방지)
  if (now - lastActivityTime < 5000) return;
  lastActivityTime = now;

  turnCount++;

  await withState(async (state: LocalState) => {
    state.activity.today_input_chars += 100; // 추정치

    // 매 턴마다 성장
    const growResults = growCrops(state);
    for (const g of growResults) {
      if (g.newStage === 1) {
        notify(chalk.green(`🌱 ${CROP_NAME_KO[g.crop]} 씨앗을 심었어요`));
      } else if (g.newStage === 2) {
        notify(chalk.green(`🌿 ${CROP_NAME_KO[g.crop]}가 쑥쑥 자라는 중...`));
      }
    }

    // 수확 가능한 것 자동 수확
    const harvests = autoHarvest(state);
    for (const h of harvests) {
      const rarityLabel = RARITY_LABEL[h.reward.rarity];
      const color = h.reward.rarity === 'legendary' ? chalk.yellow.bold
        : h.reward.rarity === 'epic' ? chalk.magenta
        : h.reward.rarity === 'rare' ? chalk.blue
        : chalk.gray;
      notify(`🌾 ${CROP_NAME_KO[h.crop]} 수확! → ${color(`⭐ ${rarityLabel} ${h.reward.name} 획득!`)}`);
    }

    // 3턴마다 새 작물 심기
    if (turnCount % 3 === 0) {
      const plantResult = plantCrop(state);
      if (plantResult) {
        notify(chalk.green(`🌱 ${CROP_NAME_KO[plantResult.crop]} 씨앗을 심었어요`));
        if (plantResult.harvestReward) {
          const r = plantResult.harvestReward;
          const rarityLabel = RARITY_LABEL[r.rarity];
          notify(`🌾 ${CROP_NAME_KO[plantResult.harvestedCrop!]} 자동 수확 → ⭐ ${rarityLabel} ${r.name}`);
        }
      }
    }

    return state;
  });
}

export function startWatcher(): void {
  if (!existsSync(CLAUDE_DIR)) {
    // Claude Code가 설치되지 않은 환경
    return;
  }

  try {
    // .claude 디렉토리의 변경을 감지
    const watcher = watch(CLAUDE_DIR, { recursive: true }, (_event, filename) => {
      if (filename && (filename.includes('conversation') || filename.includes('projects'))) {
        onClaudeActivity().catch(() => {});
      }
    });

    // 프로세스 종료 시 정리
    process.on('SIGINT', () => {
      watcher.close();
      process.exit(0);
    });
  } catch {
    // 감지 실패 시 무시 (권한 문제 등)
  }
}

// 수동 트리거 (테스트/디버그용)
export async function simulateTurn(): Promise<void> {
  await onClaudeActivity();
}
