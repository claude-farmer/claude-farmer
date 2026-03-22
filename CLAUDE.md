# CLAUDE.md — Claude Farmer

> 이 파일은 Claude Code (또는 다른 LLM)가 프로젝트를 빠르게 이해하기 위한 컨텍스트 파일입니다.

## 프로젝트 한 줄 요약

Claude Code를 쓰면 농장이 자동으로 자라고, UI를 열면 다른 사람 농장에 놀러가서 물 주고 북마크할 수 있는 **방치형 픽셀아트 농장 게임**.

## 기술 스택

- **모노레포**: npm workspaces + Turborepo
- **언어**: TypeScript (전체)
- **CLI**: Node.js, Commander, Chalk, esbuild (단일 CJS 번들)
- **Web**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Canvas 2D
- **VSCode**: Extension API, esbuild, Webview 기반 사이드바
- **배포**: Vercel (claudefarmer.com), npm (claude-farmer), VSCode Marketplace
- **인증**: GitHub OAuth (Web 세션 쿠키 + CLI 로컬 콜백 서버)
- **데이터**: 로컬 `~/.claude-farmer/state.json` + Upstash Redis (프로필, 소셜)
- **이메일**: Resend (구독 환영 이메일)
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
│   │       ├── lib/open-url.ts→ 크로스플랫폼 URL 열기 (child_process)
│   │       ├── detect/        → Claude Code 활동 감지 (fs.watch)
│   │       └── sync/          → 서버 동기화 (claudefarmer.com API)
│   ├── web/             → @claude-farmer/web (Next.js, claudefarmer.com)
│   │   ├── app/               → Next.js App Router 페이지
│   │   │   ├── page.tsx       → 랜딩 페이지 (구독 폼 포함)
│   │   │   ├── farm/          → /farm 앱 (인증 시 실제 데이터, 비인증 시 데모)
│   │   │   ├── og/            → 동적 OG 이미지 생성
│   │   │   └── api/
│   │   │       ├── auth/      → login, callback (GitHub OAuth), session, logout
│   │   │       ├── farm/      → sync, [id] (프로필 저장/조회)
│   │   │       ├── water/     → 물 주기 (일 3회 제한)
│   │   │       ├── explore/   → 랜덤 유저 탐색
│   │   │       └── subscribe/ → 이메일 구독 (Resend)
│   │   ├── components/        → FarmView, BagView, ExploreView, TabBar, FarmCanvas
│   │   ├── canvas/            → 픽셀아트 렌더링 엔진
│   │   │   ├── palette.ts     → 색상 팔레트
│   │   │   ├── sprites.ts     → 16×16 스프라이트 데이터 (코드로 정의)
│   │   │   └── renderer.ts    → FarmRenderer 클래스 (Canvas 2D)
│   │   └── lib/
│   │       ├── redis.ts       → Upstash Redis 클라이언트 (lazy init)
│   │       ├── api.ts         → 클라이언트 API 함수 (session, farm, water 등)
│   │       └── mock-data.ts   → 개발용/데모 목 데이터
│   └── vscode/          → claude-farmer-vscode (VSCode Marketplace)
│       ├── src/extension.ts   → FarmViewProvider (Webview), 에디터 활동 감지
│       ├── icon.png           → 마켓플레이스 아이콘 (128×128)
│       └── media/             → Activity bar 아이콘
```

## 빌드 & 실행

```bash
npm install              # 전체 의존성 설치
npx turbo run build      # 전체 빌드 (shared → cli, web, vscode)

# CLI 개발
cd packages/cli && npm run dev

# Web 개발
cd packages/web && npm run dev

# VSCode 익스텐션 개발
cd packages/vscode && npm run dev
```

## 핵심 게임 루프

1. Claude Code 사용 감지 (`~/.claude` 디렉토리 watch)
2. 프롬프트 입력 → 빈 칸에 랜덤 작물 심기 (4×4 = 16칸)
3. 대화 1턴 = 전체 작물 성장 1단계 (씨앗→새싹→성장→수확가능)
4. 수확가능 작물 자동 수확 → 가챠 드롭 (Common 60%, Rare 28%, Epic 10%, Legendary 2%)
5. 아이템 도감에 자동 등록 (24종)

## 인증 플로우

### Web (세션 쿠키)

1. `/api/auth/login` → GitHub OAuth 동의 화면
2. `/api/auth/callback` → 토큰 교환 → Redis에 프로필 저장 → `cf_session` httpOnly 쿠키 설정
3. `/farm` 페이지 → `/api/auth/session`에서 유저 정보 조회 → 실제 데이터 렌더링

### CLI (로컬 콜백 서버)

1. `claude-farmer init` → 브라우저에서 GitHub OAuth 열기
2. OAuth 완료 → `localhost:19274/callback`으로 리다이렉트
3. 유저 정보 수신 → `~/.claude-farmer/state.json` 생성

## Web UI 화면 (3개)

1. **농장** — Canvas 2D 픽셀아트 (256×192, 4× 스케일), 시간대별 배경 자동 전환
2. **도감** — 등급별 프로그레스 바 + 아이템 그리드 (획득/미획득)
3. **탐험** — 이웃 목록 + 랜덤 방문 + 물 주기(일 3회) + 북마크

## API 라우트 요약

| 엔드포인트 | 메서드 | 설명 |
| ----------- | ------ | ---- |
| `/api/auth/login` | GET | GitHub OAuth 시작 |
| `/api/auth/callback` | GET | OAuth 콜백 (쿠키 설정 또는 CLI 리다이렉트) |
| `/api/auth/session` | GET | 현재 세션 유저 조회 |
| `/api/auth/logout` | POST | 세션 쿠키 삭제 |
| `/api/farm/sync` | POST | CLI → 서버 프로필 동기화 |
| `/api/farm/[id]` | GET | 공개 프로필 조회 |
| `/api/water` | POST | 물 주기 (일 3회 제한) |
| `/api/explore` | GET | 랜덤 유저 탐색 |
| `/api/subscribe` | POST | 이메일 구독 + 환영 메일 |

## 디자인 원칙

- 유저 행동 = 0. 설치 후 잊어버려도 농장은 자란다.
- 귀엽고 아기자기한 픽셀아트. 따뜻한 색감.
- 미니멀 소셜 = 말풍선 + 물 주기 + 북마크 딱 3개.

## 배포 현황

- **Web**: Vercel → claudefarmer.com
- **CLI**: npm → `npm install -g claude-farmer`
- **VSCode**: Marketplace → `doribear.claude-farmer-vscode`
- **CI/CD**: GitHub Actions (push to main → build + lint)
