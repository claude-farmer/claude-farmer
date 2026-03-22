# CLAUDE.md — Claude Farmer

> Context file for Claude Code (or other LLMs) to quickly understand the project.

## One-Line Summary

An **idle pixel-art farming game** where your farm grows automatically as you use Claude Code. Visit other developers' farms, water their crops, and bookmark favorites.

## Tech Stack

- **Monorepo**: npm workspaces + Turborepo
- **Language**: TypeScript (all packages)
- **CLI**: Node.js, Commander, Chalk, esbuild (single CJS bundle)
- **Web**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Canvas 2D
- **VSCode**: Extension API, esbuild, Webview-based sidebar
- **Deployment**: Vercel (claudefarmer.com), npm (claude-farmer), VSCode Marketplace
- **Auth**: GitHub OAuth (Web session cookie + CLI local callback server + VSCode URI handler)
- **Data**: Local `~/.claude-farmer/state.json` + Upstash Redis (profiles, social)
- **Email**: Resend (subscription welcome email)
- **i18n**: Shared translation module (en/ko), auto-detect with manual override
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`)

## Package Structure

```text
claude-farmer/
├── shared/              → @claude-farmer/shared (types, constants, gacha, i18n)
│   └── src/
│       ├── types.ts     → All type definitions (CropSlot, GachaItem, LocalState, etc.)
│       ├── constants.ts → Config values (GRID_SIZE, RARITY_WEIGHTS, level calc)
│       ├── gacha.ts     → 24 gacha items + rollGacha() function
│       └── i18n.ts      → Translation dict (en/ko), detectLocale(), t() helper
├── packages/
│   ├── cli/             → claude-farmer (npm package, global install)
│   │   └── src/
│   │       ├── index.ts       → CLI entry (Commander routing)
│   │       ├── commands/      → init, status, bag, open, water, farm, config
│   │       ├── core/state.ts  → Local state CRUD (~/.claude-farmer/)
│   │       ├── core/config.ts → Language config (~/.claude-farmer/config.json)
│   │       ├── core/farm.ts   → Plant/grow/harvest/gacha core loop
│   │       ├── lib/open-url.ts→ Cross-platform URL opener (child_process)
│   │       ├── detect/        → Claude Code activity detection (fs.watch)
│   │       └── sync/          → Server sync (claudefarmer.com API)
│   ├── web/             → @claude-farmer/web (Next.js, claudefarmer.com)
│   │   ├── app/               → Next.js App Router pages
│   │   │   ├── page.tsx       → Landing page (subscribe form, EN/KO toggle)
│   │   │   ├── farm/          → /farm app (real data when logged in, demo otherwise)
│   │   │   ├── og/            → Dynamic OG image generation
│   │   │   └── api/
│   │   │       ├── auth/      → login, callback (GitHub OAuth), session, logout
│   │   │       ├── farm/      → sync, [id] (profile save/fetch)
│   │   │       ├── water/     → Watering (3/day limit)
│   │   │       ├── explore/   → Random user discovery
│   │   │       └── subscribe/ → Email subscription (Resend)
│   │   ├── components/        → FarmView, BagView, ExploreView, TabBar, FarmCanvas
│   │   ├── canvas/            → Pixel art rendering engine
│   │   │   ├── palette.ts     → Color palette
│   │   │   ├── sprites.ts     → 16×16 sprite data (defined in code)
│   │   │   └── renderer.ts    → FarmRenderer class (Canvas 2D)
│   │   └── lib/
│   │       ├── redis.ts       → Upstash Redis client (lazy init)
│   │       ├── api.ts         → Client API functions (session, farm, water, etc.)
│   │       ├── i18n.ts        → Web-specific translation dict + detectLocale()
│   │       ├── locale-context.tsx → React context provider + useLocale() hook
│   │       └── mock-data.ts   → Dev/demo mock data
│   └── vscode/          → claude-farmer-vscode (VSCode Marketplace)
│       ├── src/extension.ts   → FarmViewProvider (Webview), editor activity detection, OAuth URI handler
│       ├── icon.png           → Marketplace icon (128×128)
│       └── media/             → Activity bar icon
```

## Build & Run

```bash
npm install              # Install all dependencies
npx turbo run build      # Build all (shared → cli, web, vscode)

# CLI dev
cd packages/cli && npm run dev

# Web dev
cd packages/web && npm run dev

# VSCode extension dev
cd packages/vscode && npm run dev
```

## Core Game Loop

1. Detect Claude Code usage (`~/.claude` directory watch)
2. Prompt input → plant random crop in empty slot (4×4 = 16 slots)
3. 1 conversation turn = all crops grow 1 stage (seed → sprout → growing → harvestable)
4. Auto-harvest ready crops → gacha drop (Common 60%, Rare 28%, Epic 10%, Legendary 2%)
5. Items auto-registered in codex (24 items total)

## Auth Flows

### Web (Session Cookie)

1. `/api/auth/login` → GitHub OAuth consent screen
2. `/api/auth/callback` → token exchange → save profile in Redis → set `cf_session` httpOnly cookie
3. `/farm` page → fetch user from `/api/auth/session` → render real data

### CLI (Local Callback Server)

1. `claude-farmer init` → open GitHub OAuth in browser
2. OAuth complete → redirect to `localhost:19274/callback`
3. Receive user info → create `~/.claude-farmer/state.json`

### VSCode (URI Handler)

1. `claudeFarmer.login` command → open `claudefarmer.com/api/auth/login?from=vscode`
2. OAuth complete → redirect to `vscode://doribear.claude-farmer-vscode/callback?...`
3. Extension receives URI → create local state → show farm view

## i18n

- Default: English. Korean when locale is `ko`.
- **Web**: Auto-detect via `navigator.language` + EN/KO toggle in footer
- **VSCode**: Auto-detect via `vscode.env.language` + `claudeFarmer.language` setting (auto/en/ko)
- **CLI**: Auto-detect via `$LANG` env var + `claude-farmer config --lang ko|en`
- Shared translation module: `shared/src/i18n.ts`

## Web UI Screens (3)

1. **Farm** — Canvas 2D pixel art (256×192, 4× scale), time-based background
2. **Codex** — Rarity-grouped progress bars + item grid (obtained/locked)
3. **Explore** — Neighbor list + random visit + watering (3/day) + bookmarks

## API Routes

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/auth/login` | GET | Start GitHub OAuth |
| `/api/auth/callback` | GET | OAuth callback (cookie, CLI redirect, or VSCode URI) |
| `/api/auth/session` | GET | Get current session user |
| `/api/auth/logout` | POST | Delete session cookie |
| `/api/farm/sync` | POST | CLI → server profile sync |
| `/api/farm/[id]` | GET | Public profile lookup |
| `/api/water` | POST | Water a user's farm (3/day limit) |
| `/api/explore` | GET | Random user discovery |
| `/api/subscribe` | POST | Email subscription + welcome email |

## Design Principles

- Zero user effort required. Install and forget — your farm grows on its own.
- Cute, cozy pixel art. Warm color palette.
- Minimal social = status bubble + watering + bookmarks. Just 3 things.

## Deployment

- **Web**: Vercel → claudefarmer.com
- **CLI**: npm → `npm install -g claude-farmer` (v0.2.0)
- **VSCode**: Marketplace → `doribear.claude-farmer-vscode` (v0.2.0)
- **CI/CD**: GitHub Actions (push to main → build + lint)
