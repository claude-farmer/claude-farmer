import { GRID_SIZE } from '@claude-farmer/shared';
import type { LocalState, PublicProfile } from '@claude-farmer/shared';

// 개발용 목 데이터 (나중에 실제 API로 교체)
export const MOCK_STATE: LocalState = {
  version: 1,
  user: {
    github_id: 'demo',
    nickname: '데모농부',
    avatar_url: 'https://github.com/demo.png',
    created_at: '2025-01-01T00:00:00Z',
  },
  farm: {
    level: 3,
    grid: [
      { slot: 0, crop: 'carrot', stage: 3, planted_at: '2025-01-01T00:00:00Z' },
      { slot: 1, crop: 'tomato', stage: 2, planted_at: '2025-01-01T01:00:00Z' },
      { slot: 2, crop: 'sunflower', stage: 1, planted_at: '2025-01-01T02:00:00Z' },
      { slot: 3, crop: 'strawberry', stage: 0, planted_at: '2025-01-01T03:00:00Z' },
      { slot: 4, crop: 'pumpkin', stage: 3, planted_at: '2025-01-01T04:00:00Z' },
      { slot: 5, crop: 'radish', stage: 2, planted_at: '2025-01-01T05:00:00Z' },
      null, null, null, null, null, null, null, null, null, null,
    ],
    total_harvests: 12,
  },
  inventory: [
    { id: 'c01', name: '돌멩이', rarity: 'common', obtained_at: '2025-01-01T00:00:00Z' },
    { id: 'c04', name: '지렁이', rarity: 'common', obtained_at: '2025-01-02T00:00:00Z' },
    { id: 'c09', name: '버섯', rarity: 'common', obtained_at: '2025-01-03T00:00:00Z' },
    { id: 'r01', name: '고양이', rarity: 'rare', obtained_at: '2025-01-04T00:00:00Z' },
    { id: 'r03', name: '꽃밭', rarity: 'rare', obtained_at: '2025-01-05T00:00:00Z' },
    { id: 'e01', name: '분수대', rarity: 'epic', obtained_at: '2025-01-06T00:00:00Z' },
  ],
  status_message: { text: '사이드 프로젝트 같이할 사람?', link: 'https://github.com', updated_at: '2025-01-01T00:00:00Z' },
  bookmarks: ['friend1', 'friend2'],
  activity: {
    today_input_chars: 4523,
    today_harvests: 3,
    today_water_received: 2,
    today_water_given: 1,
    streak_days: 7,
    last_active_date: '2025-01-07',
  },
  last_synced: '2025-01-07T12:00:00Z',
};

export const MOCK_NEIGHBORS: PublicProfile[] = [
  {
    nickname: '코딩하는곰',
    avatar_url: 'https://github.com/bear.png',
    level: 5,
    total_harvests: 42,
    status_message: { text: 'React 최고!', updated_at: '2025-01-07T00:00:00Z' },
    farm_snapshot: { level: 5, grid: new Array(GRID_SIZE).fill(null), total_harvests: 42 },
    last_active: '2025-01-07T10:00:00Z',
  },
  {
    nickname: '밤새는개발자',
    avatar_url: 'https://github.com/dev.png',
    level: 2,
    total_harvests: 8,
    status_message: { text: '블로그 새 글 올림!', link: 'https://blog.dev', updated_at: '2025-01-07T00:00:00Z' },
    farm_snapshot: { level: 2, grid: new Array(GRID_SIZE).fill(null), total_harvests: 8 },
    last_active: '2025-01-07T03:00:00Z',
  },
];
