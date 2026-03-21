# 🌱 Claude Farmer

**Your code grows a farm.**

Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임입니다.

![License](https://img.shields.io/badge/license-MIT-green)

## 어떻게 작동하나요?

1. `npm install -g claude-farmer` 설치
2. `claude-farmer init` 초기화
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
claude-farmer init         # 초기화
claude-farmer status "msg" # 말풍선 설정
claude-farmer bag          # 도감
claude-farmer open         # 웹 UI 열기
claude-farmer water @user  # 물 주기
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
```

## 프로젝트 구조

```
claude-farmer/
├── shared/           # 공유 타입, 상수, 가챠 로직
├── packages/
│   ├── cli/          # npm: claude-farmer (CLI)
│   └── web/          # claudefarmer.com (Next.js)
├── .github/workflows # CI/CD
└── CLAUDE.md         # AI 컨텍스트 파일
```

## 링크

- 🌐 [claudefarmer.com](https://claudefarmer.com)
- 📦 [npm: claude-farmer](https://www.npmjs.com/package/claude-farmer)

## License

MIT
