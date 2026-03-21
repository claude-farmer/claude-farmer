# CLAUDE.md — Claude Farmer

> 이 파일은 Claude Code (또는 다른 LLM)가 프로젝트를 빠르게 이해하기 위한 컨텍스트 파일입니다.

## 프로젝트 한 줄 요약

Claude Code를 쓰면 농장이 자동으로 자라고, UI를 열면 다른 사람 농장에 놀러가서 물 주고 북마크할 수 있는 **방치형 픽셀아트 농장 게임**.

## 기술 스택

- **모노레포**: npm workspaces + Turborepo
- **언어**: TypeScript (전체)
- **CLI**: Node.js, Commander, Chalk
- **Web**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Canvas 2D
- **배포**: Vercel (claudefarmer.com)
- **데이터**: 로컬 `~/.claude-farmer/state.json` + Upstash Redis (소셜, TODO)
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`)

## 패키지 구조

```
claude-farmer/
├── shared/              → @claude-farmer/shared (공유 타입, 상수, 가챠 로직)
│   └── src/
│       ├── types.ts     → 모든 타입 정의 (CropSlot, GachaItem, LocalState 등)
│       ├── constants.ts → 설정값 (GRID_SIZE, RARITY_WEIGHTS, 레벨 계산)
│       └── gacha.ts     → 가챠 아이템 24종 + rollGacha() 함수
├── packages/
│   ├── cli/             → claude-farmer (npm 패키지, 글로벌 설치)
│   │   └── src/
│   │       ├── index.ts       → CLI 엔트리 (commander 라우팅)
│   │       ├── commands/      → init, status, bag, open, water, farm
│   │       ├── core/state.ts  → 로컬 상태 CRUD (~/.claude-farmer/)
│   │       ├── core/farm.ts   → 심기/성장/수확/가챠 핵심 루프
│   │       └── detect/        → Claude Code 활동 감지 (fs.watch)
│   └── web/             → @claude-farmer/web (Next.js, claudefarmer.com)
│       ├── app/               → Next.js App Router 페이지
│       ├── components/        → FarmView, BagView, ExploreView, TabBar
│       ├── canvas/            → 픽셀아트 렌더링 엔진
│       │   ├── palette.ts     → 색상 팔레트
│       │   ├── sprites.ts     → 16×16 스프라이트 데이터 (코드로 정의)
│       │   └── renderer.ts    → FarmRenderer 클래스 (Canvas 2D)
│       └── lib/mock-data.ts   → 개발용 목 데이터
```

## 빌드 & 실행

```bash
npm install              # 전체 의존성 설치
npx turbo run build      # 전체 빌드 (shared → cli, web)

# CLI 개발
cd packages/cli && npm run dev

# Web 개발
cd packages/web && npm run dev
```

## 핵심 게임 루프

1. Claude Code 사용 감지 (`~/.claude` 디렉토리 watch)
2. 프롬프트 입력 → 빈 칸에 랜덤 작물 심기 (4×4 = 16칸)
3. 대화 1턴 = 전체 작물 성장 1단계 (씨앗→새싹→성장→수확가능)
4. 수확가능 작물 자동 수확 → 가챠 드롭 (Common 60%, Rare 28%, Epic 10%, Legendary 2%)
5. 아이템 도감에 자동 등록 (24종)

## Web UI 화면 (3개)

1. **농장** — Canvas 2D 픽셀아트 (256×192, 4× 스케일), 시간대별 배경 자동 전환
2. **도감** — 등급별 프로그레스 바 + 아이템 그리드 (획득/미획득)
3. **탐험** — 이웃 목록 + 랜덤 방문 + 물 주기(일 3회) + 북마크

## 디자인 원칙

- 유저 행동 = 0. 설치 후 잊어버려도 농장은 자란다.
- 귀엽고 아기자기한 픽셀아트. 따뜻한 색감.
- 미니멀 소셜 = 말풍선 + 물 주기 + 북마크 딱 3개.

## TODO (아직 미구현)

- [ ] GitHub OAuth 연동 (현재 CLI init은 수동 입력)
- [ ] Upstash Redis 연동 (프로필 싱크, 소셜 기능)
- [ ] Vercel 배포 설정 (claudefarmer.com 연결)
- [ ] VSCode Extension (Phase 4)
- [ ] 가챠 아이템 픽셀아트 스프라이트 (현재 코드 기반 렌더링)
