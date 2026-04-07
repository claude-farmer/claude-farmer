// ── 작물 ──
export type CropType = 'carrot' | 'tomato' | 'sunflower' | 'strawberry' | 'pumpkin' | 'radish';

export type GrowthStage = 0 | 1 | 2 | 3; // 씨앗(0) → 새싹(1) → 성장(2) → 수확가능(3)

export interface CropSlot {
  slot: number;
  crop: CropType;
  stage: GrowthStage;
  planted_at: string;
}

// ── 가챠 ──
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface GachaItem {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  rarity: Rarity;
  obtained_at: string;
}

// ── 캐릭터 커스터마이징 ──
export type CharacterType = 'human' | 'bear' | 'rabbit' | 'tiger' | 'wolf' | 'frog' | 'husky' | 'bichon' | 'corgi';
export type HairStyle = 'short' | 'long' | 'curly' | 'ponytail' | 'bun' | 'spiky' | 'bob' | 'buzz';
export type SkinTone = 'light' | 'medium' | 'dark' | 'pale';
export type EyeStyle = 'dot' | 'round' | 'line' | 'star' | 'closed';
export type Accessory = 'none' | 'glasses' | 'sunglasses' | 'eyepatch' | 'bandaid';

export interface CharacterAppearance {
  type: CharacterType;
  hairStyle?: HairStyle;     // human only
  hairColor?: string;        // hair palette ID
  skinTone?: SkinTone;       // human only
  eyeStyle?: EyeStyle;
  accessory?: Accessory;
  clothesColor?: string;     // clothes palette ID
}

// ── 유저 ──
export interface UserProfile {
  github_id: string;
  nickname: string;
  avatar_url: string;
  created_at: string;
  character?: CharacterAppearance;
}

export interface StatusMessage {
  text: string;
  link?: string;
  updated_at: string;
}

// ── 농장 ──
export interface Farm {
  level: number;
  grid: (CropSlot | null)[];
  total_harvests: number;
}

export interface Activity {
  today_input_chars: number;
  today_harvests: number;
  today_water_received: number;
  today_water_given: number;
  streak_days: number;
  last_active_date: string;
}

// ── 전체 로컬 상태 ──
export interface LocalState {
  version: number;
  user: UserProfile;
  farm: Farm;
  inventory: InventoryItem[];
  status_message: StatusMessage | null;
  bookmarks: string[];
  activity: Activity;
  last_synced: string;
}

// ── 공개 프로필 (Redis) ──
export interface PublicProfile {
  nickname: string;
  avatar_url: string;
  level: number;
  total_harvests: number;
  unique_items?: number;
  streak_days?: number;
  today_input_chars?: number;
  today_harvests?: number;
  today_water_given?: number;
  inventory?: InventoryItem[];
  status_message: StatusMessage | null;
  farm_snapshot: Farm;
  last_active: string;
  character?: CharacterAppearance;
  // 누적 소셜 카운터 (서버에서 합산)
  total_visitors?: number;
  total_water_received?: number;
}

// ── 소셜: 발자국 ──
export interface Footprint {
  github_id: string;
  nickname: string;
  visited_at: string;
  watered: boolean;
  crop_slot?: number;
}

// ── 소셜: 방명록 ──
export interface GuestbookEntry {
  from_id: string;
  from_nickname: string;
  from_avatar_url?: string;
  type: 'visit' | 'water' | 'gift';
  message: string | null;  // visitor's status_message
  item_id?: string;        // for gift type
  at: string;              // ISO timestamp
}

// ── 소셜: 알림 ──
export interface FarmNotifications {
  visitors: Footprint[];
  visitor_count: number;
  water_received: { from_nickname: string; from_id: string; crop_slot?: number; at: string }[];
  water_received_count: number;
}
