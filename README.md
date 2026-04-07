# 🌱 Claude Farmer

**Your code grows a farm.**

An idle pixel-art farming game powered by Claude Code. You write code, crops pop up. You keep coding, they grow. Forget about it — your farm takes care of itself.

[![npm](https://img.shields.io/npm/v/claude-farmer)](https://www.npmjs.com/package/claude-farmer)
[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/doribear.claude-farmer-vscode)](https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[![A random farm from claudefarmer.com](https://claudefarmer.com/api/og/random)](https://claudefarmer.com)

## Wait, What?

You install it. You code. A farm appears. That's it.

1. `npm install -g claude-farmer`
2. `claude-farmer init` (GitHub login, takes 10 seconds)
3. Go back to coding with Claude Code
4. Come back later — your farm has grown, crops are harvested, and you've got shiny gacha items

No clicking. No watering. No grinding. Just... code.

## The Loop

```text
Code with Claude → Seeds planted → Crops grow → Auto-harvest → Gacha drop!
```

- 🌰 **Seed** → 🌱 **Sprout** → 🌿 **Growing** → 🥕 **Harvestable!**
- Every harvest triggers a gacha roll: Common (60%) / Rare (28%) / Epic (10%) / Legendary (2%)
- 32 collectible items — can you catch 'em all?

## CLI Commands

```bash
claude-farmer              # Check on your farm
claude-farmer init         # Set up (GitHub OAuth)
claude-farmer status "msg" # Set a status bubble ("looking for collab!")
claude-farmer bag          # See your collection
claude-farmer open         # Open the web UI
claude-farmer water @user  # Water a friend's farm (5-min cooldown)
claude-farmer watch        # Background mode — detects Claude Code activity
claude-farmer config       # Settings (language, etc.)
```

## Language

Auto-detects your system locale. Defaults to English, switches to Korean for `ko`.

```bash
claude-farmer config --lang ko   # 한국어로 전환
claude-farmer config --lang en   # Back to English
```

## Your Farm Looks Like This

```text
🌱 @yourname's farm (Lv.3)          ☀️ Good afternoon!
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
💧 Water received today: 2
```

## Your Profile on the Web

Every farmer gets a public page at `claudefarmer.com/@yourname` — pixel-art canvas, status, stats, guestbook, the works. Share the link anywhere and you'll get a custom preview card with your farm rendered as actual pixel art (not just text), so messengers and search results show off your character, level, and current status.

- **Profile page**: card-based layout — status bubble, records, today's activity, codex, guestbook, neighbors carousel
- **Share card**: in-app share modal generates an 800×800 PNG you can save or share natively
- **OG / link previews**: per-user 1200×630 server-rendered card with your pixel-art thumbnail, auto-updates when you sync
- **Google search**: profile pages are in the sitemap with `ProfilePage` schema + `og:image`

## Social

Lightweight, low-pressure social — built around generosity, not competition.

- **💬 Status bubble** — one-liner with optional link
- **💧 Watering** — 5-minute cooldown, boosts a friend's crops
- **🎁 Gifting** — send gacha items from your inventory
- **🔖 Bookmarks** — save farms you vibe with; mutual bookmarks = 🏡 neighbors
- **✍️ Guestbook** — chat-style log of every visit, water, and gift
- **🏆 Thank-you wall** — per-farm ranking of who watered/gifted you the most (not a global leaderboard)
- **👣 Ghost visits** — visitors leave fading footprints on your farm (24h)
- **🌊 Wave surf** — jump to a random bookmark from any farm you visit

Visit other developers' farms at [claudefarmer.com](https://claudefarmer.com)

## VSCode Extension

Why leave your editor? Search **Claude Farmer** in the marketplace, or:

```bash
ext install doribear.claude-farmer-vscode
```

Your farm lives right in the sidebar. Code → watch it grow. It's dangerously satisfying.

- Language: Settings → `claudeFarmer.language` (auto / en / ko)

## Development

```bash
npm install              # Install dependencies
npx turbo run build      # Build all (shared → cli, web, vscode)

cd packages/web && npm run dev      # Web dev server
cd packages/cli && npm run dev      # CLI dev
cd packages/vscode && npm run dev   # VSCode extension dev
```

## Project Structure

```text
claude-farmer/
├── shared/           # Types, constants, gacha logic, i18n
├── packages/
│   ├── cli/          # npm: claude-farmer
│   ├── web/          # claudefarmer.com (Next.js)
│   └── vscode/       # VSCode Marketplace extension
├── .github/workflows # CI/CD
└── CLAUDE.md         # AI context file
```

## Contributing

Pull requests, ideas, and bug reports are all welcome! Whether it's a new gacha item, a better sprite, or a wild feature idea — let's build something fun together. 🌱

## Links

- 🌐 [claudefarmer.com](https://claudefarmer.com) — play & explore farms
- 📦 [npm: claude-farmer](https://www.npmjs.com/package/claude-farmer)
- 🧩 [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=doribear.claude-farmer-vscode)
- 🐙 [GitHub](https://github.com/claude-farmer/claude-farmer)

## License

MIT — built with 🌱 by [doribear.com](https://doribear.com) 🇰🇷
