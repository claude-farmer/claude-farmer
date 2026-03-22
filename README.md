# 🌱 Claude Farmer

**Your code grows a farm.**

Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임입니다.

[![npm](https://img.shields.io/npm/v/claude-farmer)](https://www.npmjs.com/package/claude-farmer)
[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/doribear.claude-farmer-vscode)](https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 어떻게 작동하나요?

1. `npm install -g claude-farmer` 설치
2. `claude-farmer init` 초기화 (GitHub 로그인)
3. **Claude Code를 사용하면 자동으로 농장이 자랍니다** 🌱
4. 수확하면 가챠로 아이템 획득 → 도감 수집!
5. [claudefarmer.com](https://claudefarmer.com)에서 다른 사람 농장 구경 & 물 주기

## 게임 루프

```
Claude Code 사용 → 씨앗 심기 → 대화할수록 성장 → 자동 수확 → 가챠!
```

- 🌰 씨앗 → 🌱 새싹 → 🌿 성장 → 🥕 수확 가능
- 수확하면 랜덤 가챠: Common(60%) / Rare(28%) / Epic(10%) / Legendary(2%)
- 24종 아이템 도감 수집

## CLI 명령어

```bash
claude-farmer              # 내 농장 보기
claude-farmer init         # 초기화 (GitHub OAuth 로그인)
claude-farmer status "msg" # 말풍선 설정
claude-farmer bag          # 도감
claude-farmer open         # 웹 UI 열기
claude-farmer water @user  # 물 주기
claude-farmer watch        # 백그라운드 감지 모드
```

## 농장 미리보기

```
🌱 @myname의 농장 (Lv.3)          ☀️ 좋은 오후에요!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────┬────┬────┬────┐
│ 🌱 │ 🌿 │ 🌾 │ 🥕 │
├────┼────┼────┼────┤
│ 🍅 │ 🌱 │    │    │
├────┼────┼────┼────┤
│    │    │    │    │
├────┼────┼────┼────┤
│    │    │    │    │
└────┴────┴────┴────┘
💬 "사이드 프로젝트 같이할 사람?"

📦 도감: 8/24 (33%)  🪙 수확: 12회
💧 오늘 받은 물: 2회
```

## 소셜 기능 (3개만)

- **💬 말풍선** — 한 줄 상태 메세지 + 링크
- **💧 물 주기** — 하루 3회, 상대 작물 성장 부스트
- **🔖 북마크** — 마음에 드는 농장 즐겨찾기

## VSCode Extension

VSCode 마켓플레이스에서 **Claude Farmer**를 검색하거나:

```
ext install doribear.claude-farmer-vscode
```

사이드바에서 픽셀아트 농장을 직접 볼 수 있습니다. 에디터에서 코딩하면 자동으로 농장이 자라요!

## 개발

```bash
# 의존성 설치
npm install

# 전체 빌드
npx turbo run build

# Web 개발 서버
cd packages/web && npm run dev

# CLI 개발
cd packages/cli && npm run dev

# VSCode 익스텐션 개발
cd packages/vscode && npm run dev
```

## 프로젝트 구조

```
claude-farmer/
├── shared/           # 공유 타입, 상수, 가챠 로직
├── packages/
│   ├── cli/          # npm: claude-farmer (CLI)
│   ├── web/          # claudefarmer.com (Next.js)
│   └── vscode/       # VSCode Marketplace Extension
├── .github/workflows # CI/CD
└── CLAUDE.md         # AI 컨텍스트 파일
```

## 링크

- 🌐 [claudefarmer.com](https://claudefarmer.com)
- 📦 [npm: claude-farmer](https://www.npmjs.com/package/claude-farmer)
- 🧩 [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode)
- 🐙 [GitHub](https://github.com/claude-farmer/claude-farmer)

## License

MIT
