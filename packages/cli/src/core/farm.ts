import type { LocalState, CropSlot, CropType, GrowthStage, InventoryItem } from '@claude-farmer/shared';
import { CROPS, GRID_SIZE, MAX_GROWTH_STAGE, calculateLevel } from '@claude-farmer/shared';
import { rollGacha } from '@claude-farmer/shared';

function randomCrop(): CropType {
  return CROPS[Math.floor(Math.random() * CROPS.length)];
}

function findEmptySlot(grid: (CropSlot | null)[]): number {
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === null) return i;
  }
  return -1;
}

function findOldestSlot(grid: (CropSlot | null)[]): number {
  let oldest = -1;
  let oldestTime = Infinity;
  for (let i = 0; i < grid.length; i++) {
    const slot = grid[i];
    if (slot) {
      const time = new Date(slot.planted_at).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldest = i;
      }
    }
  }
  return oldest;
}

export interface PlantResult {
  slotIndex: number;
  crop: CropType;
  harvestedCrop?: CropType;
  harvestReward?: InventoryItem;
}

export function plantCrop(state: LocalState): PlantResult | null {
  const crop = randomCrop();
  let slotIndex = findEmptySlot(state.farm.grid);
  let harvestedCrop: CropType | undefined;
  let harvestReward: InventoryItem | undefined;

  // 모든 칸이 차면 가장 오래된 칸 수확 후 심기
  if (slotIndex === -1) {
    const oldestIdx = findOldestSlot(state.farm.grid);
    if (oldestIdx === -1) return null;
    const result = harvestSlot(state, oldestIdx);
    if (result) {
      harvestedCrop = result.crop;
      harvestReward = result.reward;
    }
    slotIndex = oldestIdx;
  }

  state.farm.grid[slotIndex] = {
    slot: slotIndex,
    crop,
    stage: 0 as GrowthStage,
    planted_at: new Date().toISOString(),
  };

  return { slotIndex, crop, harvestedCrop, harvestReward };
}

export interface GrowResult {
  slotIndex: number;
  crop: CropType;
  newStage: GrowthStage;
}

export function growCrops(state: LocalState): GrowResult[] {
  const results: GrowResult[] = [];
  for (let i = 0; i < state.farm.grid.length; i++) {
    const slot = state.farm.grid[i];
    if (slot && slot.stage < MAX_GROWTH_STAGE) {
      slot.stage = (slot.stage + 1) as GrowthStage;
      results.push({ slotIndex: i, crop: slot.crop, newStage: slot.stage });
    }
  }
  return results;
}

export interface HarvestResult {
  crop: CropType;
  reward: InventoryItem;
}

export function harvestSlot(state: LocalState, slotIndex: number): HarvestResult | null {
  const slot = state.farm.grid[slotIndex];
  if (!slot) return null;

  const item = rollGacha();
  const reward: InventoryItem = {
    id: item.id,
    name: item.name,
    rarity: item.rarity,
    obtained_at: new Date().toISOString(),
  };

  state.inventory.push(reward);
  state.farm.total_harvests++;
  state.activity.today_harvests++;
  state.farm.level = calculateLevel(state.farm.total_harvests);
  state.farm.grid[slotIndex] = null;

  return { crop: slot.crop, reward };
}

export function autoHarvest(state: LocalState): HarvestResult[] {
  const results: HarvestResult[] = [];
  for (let i = 0; i < state.farm.grid.length; i++) {
    const slot = state.farm.grid[i];
    if (slot && slot.stage >= MAX_GROWTH_STAGE) {
      const result = harvestSlot(state, i);
      if (result) results.push(result);
    }
  }
  return results;
}
