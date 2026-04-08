# Profile Page & Share/OG Redesign — Progress Log

작업 기간: 2026-04-07
범위: 프로필 페이지 카드 시스템 통일, 인앱 공유 모달, 메신저/검색용 OG 이미지

---

## 1. 카드 시스템 통일

### 목표
프로필 페이지 안의 모든 섹션을 동일한 Header / Body / Footer 패턴으로 정렬하고, 빈 공간/일관성 문제를 해소.

### 적용된 것
- **`<Card>` 프리미티브** 신규 ([packages/web/components/Card.tsx](../packages/web/components/Card.tsx))
  - faded header (border-b) + body + 옵셔널 footer (border-t)
  - `headerRight` 슬롯, `bodyClassName` 커스터마이징
- **프로필 카드 통합** — 기존 분리된 Status bubble + Identity strip + visit Action Bar를 하나로
  - Header: 농부 칭호 + 🔥 스트릭, 우측 carved-out 북마크 (visit + 로그인 시)
  - Body: 채팅 스타일 말풍선 (아바타 + 닉네임 · time + 둥근 버블 + 링크 footer)
  - Own farm: footer에 ✏️ 수정하기 버튼
- **Records 카드** — 어색한 2×2 grid → 가로 4-stat (아이콘 라벨 옆, 숫자 위)
  - 도감은 `x/32` → `퍼센트(%)` (반올림)
- **Today 카드** — 자기 농장 최상단 이동, 좌측 accent border 제거
- **Codex Compact** — 1줄로 제한 (10개 + `+N` chip), `whitespace-nowrap overflow-hidden`
- **Empty Farm / Discover / Recent** 모두 Card 사용

### 실패/돌아간 것
- 처음에는 Status를 단일 row로, Identity를 별도 카드로 두었다가 통합 → 이후 다시 footer 액션 분리 (water/gift는 방명록 footer로 이동)

---

## 2. 헤더 / 모달 일관성

### 적용된 것
- **GitHub 스타일 outline h-8 네비게이션**
  - 좌: 햄버거(앱 메뉴) + 방문 농장 아바타/닉네임/Lv
  - 우: 검색, 공유, 내 아바타(계정 메뉴) 또는 로그인
  - 모든 요소 `h-8 rounded-lg`, 동일 stroke
- **모달 헤더 sticky** — About / Share / Codex / Search / Guestbook / Rankings 모두 헤더 고정 + 바디만 스크롤
- **모달 닫기 버튼** outline 사각형으로 통일
- **백드롭 블러** — 모든 bottom-sheet 모달 + 햄버거 드롭다운에 `bg-black/50 backdrop-blur-sm`
- **About 컨텐츠 여백** 루즈하게 조정

### 실패
- 처음에 닉네임 옆 `Lv.10` 측정 시 폰트 변경 후 `measureText` 호출 → 닉네임에 겹쳐 그려진 버그. measureText를 폰트 변경 전에 옮겨 수정. 결국 Lv를 stats 라인으로 이동.

---

## 3. 방명록 (Guestbook)

### 적용된 것
- **채팅 스타일** — 36px 아바타 + 닉네임·time + 액션 라벨 + 둥근 말풍선 (`rounded-2xl rounded-tl-sm`)
- **카드 본문 5개 제한**, max-h 스크롤 제거
- **헤더 우측 카운트 chip** — `🎁 N`, `💧 M`, `✍️ K` 클릭 시 모달
  - 물/선물 → `RankingsModal` (사용자별 누적 랭킹, 탭 전환)
  - 방명록 → `GuestbookModal` (전체 항목 스크롤)
- **연속 동일 항목 그룹핑** — 같은 사용자 + 같은 message + 같은 link면 type(water/gift)에 상관없이 묶음, `🎁 ×3 · 💧 ×2` 표시
- **말풍선 ↔ 프로필 카드 통일** — 동일한 padding/radius/font, status text + link 모두 표시
- **link 스냅샷** — water/gift/visit 시점의 보낸 사람 status_message 저장 (`GuestbookEntry.link?` 추가)
- **방명록 카드 footer** — visit 시 물주기/선물 버튼 (action 진입 통합), 비로그인 시 로그인 CTA, body 하단 hint

### 버그 수정
- **북마크/방문/알림 라우트가 옛날 `JSON.parse(session)` 사용** → HMAC 서명 도입 후 401로 silent fail → 새로고침 시 북마크 사라짐. `extractUserId()`로 마이그레이션.
- **방문자 카운트 24시간 unique 체크 제거** → 매 방문마다 +1
- **낙관적 visit count 업데이트** → 새로고침 lag 제거
- **link 저장 시 `https://` 검사 제거** → 사용자가 `example.com`만 입력해도 저장, 렌더 시점에 자동 prefix
- **방명록 entry의 link** `undefined` → `null`로 명시 (JSON.stringify 안정성)

---

## 4. 인앱 공유 모달 (ShareCanvas)

### 적용된 것
- **클라이언트 캔버스 800×800 공유 이미지** — `ShareCanvas.tsx`
  - 64×64 thumbnail scene 8× nearest-neighbor blit (512×512)
  - 상단 브랜딩 + 닉네임 + 통계 + URL
  - `getBlob()` ref로 노출 → 다운로드/네이티브 공유에 사용
- **수정된 download/share 핸들러**
  - `canvas.toBlob` → blob URL → 다운로드
  - `navigator.share({files: [File]})` 시도, 미지원 시 URL-only fallback
- **`canvas/thumbnailScene.ts`** 추출 — `prepareThumbnailScene` + `renderThumbnailFrame` 순수 함수, FarmThumbnail.tsx와 ShareCanvas.tsx 공유

### 실패/시행착오
- 처음엔 서버 OG 라우트의 PNG를 fetch해서 표시 → edge runtime ImageResponse가 한글/이모지로 빈 응답 반환 → 클라이언트 캔버스로 전환

---

## 5. 메신저/검색 OG 이미지

### Satori (next/og) 제약 발견 (실패 사례)
이 부분이 가장 많은 시행착오 — Satori는 엄격한 CSS 부분집합만 지원하고 실패 시 헤더만 보낸 후 빈 body를 stream으로 반환한다. 한 번 빈 응답이 캐싱되면 영구히 깨진다.

#### 발견한 제약
1. **CJK/이모지 글리프** — 폰트 누락 시 silent fail
2. **`<img src="https://...">`** — 외부 이미지 fetch 실패가 잦음 (GitHub 아바타조차 안 됨)
3. **`filter: blur()`** — absolute children에는 적용 안 됨 (시각적으로 변화 없음)
4. **`letterSpacing`, `fontStyle: italic`, complex transforms** — 종종 실패
5. **try/catch 무효** — ImageResponse가 lazy stream이라 헤더 송신 후 에러는 catch 불가
6. **Vercel cache** — 빈 응답을 1년 캐싱 → 일단 깨지면 URL 변경/수동 무효화 필요

#### 우회한 방법
1. **`asciiSafe()`** — 닉네임/상태 텍스트에서 non-ASCII 제거
2. **이모지/이미지 모두 제거** — 텍스트 전용으로 단순화
3. **`?v={timestamp}` 캐시 버스터** — `last_active` 기반
4. **Cache-Control 1년 → 1시간** — 실패해도 1시간 안에 자동 복구
5. **모든 div에 `display: 'flex'` 명시** — Satori 강제 요구
6. **`backgroundColor`/`borderRadius`/`clipPath`/`linear-gradient`** 만 사용
7. **블러 우회**: `filter: blur` 대신 사용자별 sky 테마 색상으로 `linear-gradient` 배경

#### 가장 큰 우회 — 픽셀 아트 → Satori divs 변환
- Satori는 Canvas2D를 못 돌리므로 64×64 픽셀 아트를 직접 그릴 수 없음
- **`CanvasRecorder` shim** ([packages/web/canvas/thumbnailRects.ts](../packages/web/canvas/thumbnailRects.ts)) 작성 — `fillStyle`/`fillRect`/`clearRect`/`globalAlpha`/`createLinearGradient` 가짜 ctx로 모든 fillRect 호출을 `{x,y,w,h,color,opacity}` 리스트로 캡처
- 기존 `renderThumbnailFrame()`을 이 recorder에 통과 → ~200-400개 사각형 리스트
- Satori JSX에서 absolute positioned div로 렌더 (8.59× 스케일)
- 그라데이션은 1px 슬라이스로 row-by-row lerp
- **결과**: 픽셀 아트 그대로 PNG 생성 가능, 35-100KB

### 최종 OG 카드 레이아웃

```
┌──────────────────────────────────┐
│  Nickname (54px, 1.5×)           │
│                                  │
│  @username (47px, 1.3×)          │
│                                ┌──┐
│  ┃ status text (36px, 1×,      │  │
│  ┃ 노란 left border, indented)  │  │
│         ⋯                       │카│
│         ⋯                       │드│ ← 550×550 라운드 사각형
│         ⋯                       │  │ 노란 6px 보더, 텍스트와 동일 vertical bound
│                                 └──┘
│  claudefarmer.com (30px, 노란)   │
└──────────────────────────────────┘
   배경: 사용자 sky 테마 그라데이션
```

- 카드 사이즈: `H - VERT_PAD*2 = 550`, 위/아래 패딩 동일 40
- 카드 위치: 우측, 텍스트와 vertical bound 일치
- 텍스트 최대 폭: `CARD_X - 56 - 32`로 카드 침범 방지
- maxHeight + overflow:hidden으로 긴 status가 하단 로고 침범 불가
- 폰트 비율 1 / 1.3 / 1.5 (base 36)

### 실패한 다른 디자인 시도들
- 풀블리드 썸네일 + 텍스트 오버레이 + 블러 배경 → 블러 안 먹어서 픽셀이 더 선명해짐
- 1200×630 cover-crop (scale 18.75) → 사용자가 만족 못함
- 채팅 말풍선 (clip-path tail) → 완성도 떨어짐
- 좌측 풀높이 썸네일 + 우측 텍스트 → 긴 닉네임이 줄바꿈
- 좌측 + 우측 양쪽 썸네일 카드 → 중복

### 폰트 비율 변천사
- 64 / 44 / 32 → 너무 차이 큼 (사용자 피드백)
- 54 / 47 / 36 ← **최종**, 1 / 1.3 / 1.5 비율

---

## 6. 라우팅 / 메타데이터

### 적용된 것
- **`(profile)/[username]/layout.tsx`** (서버 컴포넌트) — `generateMetadata` + JSON-LD 주입
  - `og:image` per-user, `?v={last_active}` 캐시 버스터
  - title 50자 / description 150자 (opengraph.xyz 권장 길이)
  - `openGraph.type = 'profile'`, `siteName`, `images[width/height/alt]`
  - **ProfilePage JSON-LD** — `mainEntity: Person { name, image, identifier }`, `primaryImageOfPage`
- **404 → 홈 리다이렉트**
  - `app/not-found.tsx` (clientside `router.replace('/')`)
  - 프로필 페이지 notFound 시 동일
- **OG 라우트의 fallback** — 프로필 없으면 홈 스타일 카드
- **동적 sitemap.xml** — Redis `recentActive` sorted set에서 최근 1000명 추출, `/@username` 항목 포함, `lastModified = profile.last_active`, 1시간 revalidate

### 실패
- 처음엔 페이지 단의 metadata가 없어서 모든 공유 링크가 layout.tsx의 사이트 전역 og:image 사용 → 사용자가 발견. layout 추가로 해결.

---

## 7. 농장 캔버스 (FarmCanvas)

### 적용된 것
- **방문 시 ghost 캐릭터 폴백** — visitor character가 미설정이면 `generateDefaultAppearance(id)` 사용 (썸네일과 일관)
- **own farm character 동일 처리** — `profile.character ?? generateDefaultAppearance(username)` 전달
- **`composeCharacterSprite` 캐시** 그대로 활용

### 실패
- "농장 이미지가 블러되게 표시됨" 사용자 보고 → `imageRendering: pixelated`는 이미 적용됨. 디바이스 픽셀 비율 vs 캔버스 internal resolution 미스매치가 원인이지만 큰 리팩터 필요해서 보류.

---

## 8. Google 검색 썸네일

### 시그널 측면 (모두 적용 완료)
- ✅ `og:image` per-user 1200×630 (16:9)
- ✅ `twitter:summary_large_image`
- ✅ `openGraph.type = 'profile'`
- ✅ ProfilePage JSON-LD (`primaryImageOfPage` + `mainEntity.image`)
- ✅ `metadataBase`, canonical URL
- ✅ robots.txt → sitemap.xml
- ✅ Sitemap에 활성 프로필 동적 포함

### 한계 (Google 알고리즘이 자동 결정, 보장 없음)
- 텍스트 많은 OG 이미지는 Google이 덜 선호 — 우리 카드는 텍스트 多
- 파일 사이즈 35KB (Google 권장 300KB+ 미달)
- 신뢰도 누적 시간 필요

### 사용자가 직접 해야 하는 것
1. Google Search Console에 도메인 등록
2. `https://claudefarmer.com/sitemap.xml` 제출
3. 주요 URL `URL Inspection` → "Request Indexing"
4. 며칠~몇 주 후 검색 결과 노출 여부 확인

---

## 9. README 라이브 임베드 (`/api/og/random`)

### 적용된 것
- **`/api/og/random` 엣지 라우트** — `global:recent_active` sorted set 상위 100명 중 랜덤 1명 픽
- 해당 유저의 `/[username]/og` PNG를 fetch해서 **응답 body 스트림 그대로 프록시**
- README 헤더에 `[![](url)](link)` + `<sub>` 캡션으로 임베드
- Cache-Control `max-age=600 s-maxage=600 stale-while-revalidate=300` → CDN 10분 캐시 + Camo 회전

### 실패/시행착오
- 처음에 `max-age=0`으로 설정했더니 GitHub Camo가 캐싱하지 않고 이미지 표시 거부 → 600초로 늘려서 해결
- 처음엔 redirect로 구현하려 했으나 Camo가 redirect 따라간 후 그 final URL을 캐싱해서 같은 이미지에 고정될 수 있어서 stream 프록시로 변경
- Redis 비어있을 때 fallback 필요 → site-level `/og`로 302

---

## 10. SEO 보강 P1 + P3

### P1 (배포)
- **`/farm/layout.tsx` 신규** — `metadata.robots: { index: false, follow: true }` 추가, redirect 페이지지만 크롤러가 빈 페이지로 인식 안 하게
- **Root layout `alternates.languages`** — `en-US`/`ko-KR`/`x-default` hreflang 추가
- **`<html lang>` ko → en + og locale ko_KR → en_US** + `alternateLocale: ['ko_KR']` (일관성)
- **Profile layout `alternates.canonical = profileUrl`** — middleware rewrite 양쪽 다 인덱싱 방지
- **Profile JSON-LD를 배열로 변경** — `ProfilePage` + `BreadcrumbList` (Home → @username) 두 schema 동시 배포

### P3 (배포)
- **VideoGame schema 추가** — root JSON-LD에 두 번째 schema (genre/playMode/gamePlatform). `applicationSubCategory: 'IdleGame'`
- **softwareVersion** 0.1.0 (stale) → 0.3.2

### 사용자가 직접 해야 함
- Google Search Console에 등록 → sitemap 제출 → URL Inspection → Request Indexing
- KakaoTalk/Slack 공유 시 캐시 갱신은 메신저 자체 디버거 사용

---

## 11. CLI / VSCode 동기화

웹의 새 기능을 CLI와 VSCode 익스텐션에서 노출.

### CLI 새 명령
- **`claude-farmer guestbook [user]`** — `/api/farm/[id]/guestbook` fetch, 채팅 스타일 ASCII 렌더 (avatar emoji + name + action label + 시간 + 인용 메시지 + 링크)
- **`claude-farmer rankings [user]`** — `/api/farm/[id]/rankings` fetch, 1·2·3위 트로피 색상 (yellow/gray/bronze), water + gifts 두 카테고리
- **`claude-farmer gift <user> <itemId>`** — 로컬 인벤토리 검증 후 `/api/gift` POST
- **`claude-farmer character`** — flag 기반 (`--type bear --clothesColor red`), `--show`로 현재 캐릭터 확인, `--random`으로 랜덤 생성. 로컬 state 저장 + `/api/farm/character` POST
- **`farm` 명령에 누적 카운터 라인 추가** — `👥 visitors  💧 watered  🔖 bookmarks` (이미 fetchProfile 응답에 있던 데이터)
- **버전 0.2.0 → 0.3.3**, README "3/day" → "5-min cooldown" + Social 섹션 확장

### CLI 신규 파일
- `packages/cli/src/commands/guestbook.ts`
- `packages/cli/src/commands/rankings.ts`
- `packages/cli/src/commands/gift.ts`
- `packages/cli/src/commands/character.ts`
- `packages/cli/src/sync/remote.ts` — fetchGuestbook / fetchRankings / sendGift / updateCharacterRemote 헬퍼 추가

### VSCode (소규모 동기화)
- visit info row에 `total_visitors` / `total_water_received` / `total_bookmarks` 카운터 표시 (이미 fetch되던 데이터)
- visit clear 시 reset
- 버전 0.3.2 → 0.3.3

### VSCode 미루어진 작업 (별도 큰 PR)
- 4-탭 → 단일 카드 페이지 webview 재작성 (web과 동일 구조)
- 방명록/랭킹/선물/캐릭터 인라인 UI
- ShareCanvas 로직 webview 포팅 (또는 og 이미지 fetch 표시)
- 1964 line의 단일 파일 [extension.ts](packages/vscode/src/extension.ts) 분리

### 검증
- `npm run build` (turbo) — web + cli + shared 모두 성공
- VSCode TS 에러는 모두 사전 존재 (ResponseUnknown 타입), 내 변경과 무관
- CLI 새 명령 4개 등록 + version flag 0.3.3 표시 확인

---

## 핵심 교훈

### Satori (next/og)
- **금지 패턴**: 외부 `<img>`, `filter: blur()`, CJK/이모지, italic, complex transforms
- **안전 패턴**: 모든 div에 `display:flex`, `clipPath`, `linear-gradient` 배경, ASCII-safe 텍스트, `backgroundColor`/`borderRadius`/`border` shorthand
- **빈 응답 캐싱**: Cache-Control을 짧게(1시간) 두고 `?v=` 캐시 버스터 활용
- **try/catch 한계**: ImageResponse는 lazy stream이라 헤더 송신 후 에러는 못 잡음 — 사전에 데이터 검증 필요
- **픽셀 아트 우회**: Canvas2D shim으로 fillRect 호출을 div 리스트로 변환하면 Satori에서 픽셀 아트 렌더링 가능

### Vercel 캐시
- 한 번 깨진 응답이 1년 캐싱되면 URL 변경/캐시 버스터 외엔 복구 어려움 — Cache-Control을 일부러 짧게 두는 게 안전

### 메신저 미리보기
- 클라이언트 canvas는 인앱 다운로드/공유에는 완벽하지만 **외부 메신저 link preview에는 영향 없음** — 메신저는 HTML `<meta og:image>` 만 읽음
- 메신저는 link preview를 자체 캐싱 (KakaoTalk/Slack/X 등 며칠~수 주) — 새 카드는 새 URL이거나 자체 디버거 강제 갱신 필요

### 세션 인증 마이그레이션
- HMAC 서명 적용 후 모든 API 라우트가 `extractUserId()` 사용해야 함 — 누락 시 silent 401

---

## 수정된 주요 파일

| 파일 | 역할 |
|------|------|
| `packages/web/components/Card.tsx` | 카드 프리미티브 (신규) |
| `packages/web/app/(profile)/[username]/page.tsx` | 프로필 페이지 통합 |
| `packages/web/app/(profile)/[username]/layout.tsx` | generateMetadata + JSON-LD (신규) |
| `packages/web/app/(profile)/[username]/og/route.tsx` | OG 이미지 (신규/대대적 재작성) |
| `packages/web/canvas/thumbnailScene.ts` | 픽셀 아트 씬 순수 함수 (신규) |
| `packages/web/canvas/thumbnailRects.ts` | Canvas → div 리스트 shim (신규, Satori 우회) |
| `packages/web/components/ShareCanvas.tsx` | 인앱 공유 캔버스 (신규) |
| `packages/web/components/ShareModal.tsx` | 클라이언트 캔버스 사용으로 재작성 |
| `packages/web/components/GuestbookPanel.tsx` | 채팅 스타일 + 그룹핑 + 카운트 chips |
| `packages/web/components/GuestbookModal.tsx` | 전체 방명록 모달 (신규) |
| `packages/web/components/RankingsModal.tsx` | 사용자별 누적 랭킹 모달 (신규) |
| `packages/web/components/FarmThumbnail.tsx` | thumbnailScene 사용으로 슬림화 |
| `packages/web/app/sitemap.ts` | Redis 활성 프로필 동적 포함 |
| `packages/web/app/api/bookmarks/route.ts` | extractUserId 마이그레이션 + total_bookmarks |
| `packages/web/app/api/farm/[id]/visit/route.ts` | extractUserId + 매 방문 카운트 |
| `packages/web/app/api/farm/[id]/notifications/route.ts` | extractUserId 마이그레이션 |
| `packages/web/app/api/water/route.ts` | sender link 스냅샷 + per-user 랭킹 |
| `packages/web/app/api/gift/route.ts` | sender link 스냅샷 + per-user 랭킹 |
| `packages/web/app/api/farm/[id]/rankings/route.ts` | 누적 랭킹 엔드포인트 (신규) |
| `packages/web/app/api/water/cooldown/route.ts` | 물주기 쿨다운 fetch (신규) |
| `shared/src/types.ts` | `total_bookmarks`, `GuestbookEntry.link` 추가 |

---

## 12. v0.3.3 릴리즈

### 배포된 채널
- ✅ **Web** (Vercel) — `main` push 자동 deploy
- ✅ **CLI** (npm) — `claude-farmer@0.3.3` published
- ✅ **VSCode** (Marketplace) — `doribear.claude-farmer-vscode@0.3.3` published

### Release 명령
```bash
npx turbo run build
(cd packages/cli && npm publish --access public)
(cd packages/vscode && vsce publish --no-dependencies)
```

### `--no-dependencies` 함정
처음 vsce publish 시도 시 vsce가 monorepo `.git` 루트까지 climbing해서 sibling `packages/cli` + `packages/web` (300MB+) 까지 .vsix에 포함하려 함. `--no-dependencies` 플래그가 vsce의 npm dependency traversal을 막아서 해결.

`.vscodeignore`도 `packages/**`, `shared/**`, `docs/**`, `**/.turbo/**` 등 monorepo sibling 차단 패턴 추가 (safety net). 결과: vsix 34.54 KB, 10 files만 패키징.

### 8개 version 정렬 위치
1. `shared/package.json`
2. `packages/web/package.json`
3. `packages/cli/package.json`
4. `packages/cli/src/index.ts` `program.version()`
5. `packages/vscode/package.json`
6. `packages/vscode/src/extension.ts` 하드코딩 footer "v0.x.y" (×2)
7. `packages/web/app/layout.tsx` JSON-LD `softwareVersion`
8. `CLAUDE.md` Deployment 섹션
