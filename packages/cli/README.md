# 🌱 claude-farmer

**Your code grows a farm.**

An idle pixel-art farming game powered by Claude Code. Just code — your farm grows automatically!

## Install

```bash
npm install -g claude-farmer
```

## Quick Start

```bash
claude-farmer init    # GitHub login (or manual input)
claude-farmer         # View your farm
```

Then just use Claude Code. Your farm grows on its own!

## Commands

| Command | Description |
|---------|-------------|
| `claude-farmer` | Display your farm (ASCII art) |
| `claude-farmer init` | Initialize (GitHub OAuth or manual) |
| `claude-farmer status "msg"` | Set status message bubble |
| `claude-farmer bag` | Collection (item codex) |
| `claude-farmer open` | Open web UI (claudefarmer.com) |
| `claude-farmer water @user` | Water another user's farm (5-min cooldown) |
| `claude-farmer watch` | Background detection mode |
| `claude-farmer config` | View/change settings |
| `claude-farmer config --lang ko` | Set language to Korean |

## Language

Auto-detects from your system locale. Default: English.

```bash
claude-farmer config --lang ko   # Switch to Korean
claude-farmer config --lang en   # Switch to English
```

## Game Loop

```
Code with Claude → Plant seeds → Grow crops → Auto-harvest → Gacha!
```

- **4×4 farm** (16 slots) — seeds planted automatically
- **4 growth stages** — Seed 🌰 → Sprout 🌱 → Growing 🌿 → Harvest 🥕
- **Gacha drops** — Common(60%), Rare(28%), Epic(10%), Legendary(2%)
- **24 collectible items**

## Social

- 💬 **Status bubble** — a one-line message visible to other developers
- 💧 **Watering** — 5-minute cooldown, boosts a friend's crops
- 🎁 **Gifting** — send gacha items from your inventory
- 🔖 **Bookmarks** — save farms you like; mutual = neighbors
- ✍️ **Guestbook** — chat-style log of every visit/water/gift
- 🏆 **Thank-you wall** — per-farm ranking of who supported you most

## Preview

```
🌱 @myname's farm (Lv.3)          ☀️ Good afternoon!
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
💬 "Looking for side project buddies?"
📦 Collection: 8/24 (33%)  🪙 12 harvests
```

## Links

- 🌐 [claudefarmer.com](https://claudefarmer.com)
- 🧩 [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode)
- 📦 [GitHub](https://github.com/claude-farmer/claude-farmer)

## License

MIT
