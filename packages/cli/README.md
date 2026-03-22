# 🌱 claude-farmer

**Your code grows a farm.**

Claude Code를 쓰면 농장이 자동으로 자라는 방치형 픽셀아트 농장 게임입니다.

## 설치

```bash
npm install -g claude-farmer
```

## 시작하기

```bash
claude-farmer init    # GitHub 로그인 (또는 수동 입력)
claude-farmer         # 내 농장 보기
```

그 다음엔 **그냥 Claude Code를 사용하면 됩니다.** 자동으로 농장이 자라요!

## 명령어

| 명령어 | 설명 |
|--------|------|
| `claude-farmer` | 내 농장 ASCII 아트 출력 |
| `claude-farmer init` | 초기화 (GitHub OAuth 또는 수동 입력) |
| `claude-farmer status "msg"` | 말풍선 상태 메세지 설정 |
| `claude-farmer bag` | 도감 (수집한 아이템 목록) |
| `claude-farmer open` | 웹 UI 열기 (claudefarmer.com) |
| `claude-farmer water @user` | 물 주기 (하루 3회) |
| `claude-farmer watch` | 백그라운드 감지 모드 (Claude Code 활동 자동 감지) |

## 게임 루프

```
Claude Code 사용 → 씨앗 심기 → 대화할수록 성장 → 자동 수확 → 가챠!
```

- **4×4 농장** (16칸) — 빈 칸에 자동으로 씨앗이 심겨요
- **4단계 성장** — 씨앗 🌰 → 새싹 🌱 → 성장 🌿 → 수확 🥕
- **가챠 드롭** — Common(60%), Rare(28%), Epic(10%), Legendary(2%)
- **24종 아이템** 도감 수집

## 소셜

- 💬 **말풍선** — 다른 개발자에게 보이는 한 줄 메세지
- 💧 **물 주기** — 하루 3회, 상대 작물 성장 부스트
- 🔖 **북마크** — 마음에 드는 농장 즐겨찾기

## 미리보기

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
```

## 링크

- 🌐 [claudefarmer.com](https://claudefarmer.com)
- 🧩 [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=claude-farmer.claude-farmer-vscode)
- 📦 [GitHub](https://github.com/claude-farmer/claude-farmer)

## License

MIT
