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
│       ├── constants.ts → Config values (GRID_SIZE, RARITY_WEIGHTS, level calc, farmer titles)
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
│   │   │       ├── farm/      → sync, status, [id] (profile+footprints), [id]/notifications, [id]/visit
│   │   │       ├── water/     → Watering (3/day limit, optional crop_slot)
│   │   │       ├── explore/   → Random user discovery
│   │   │       └── subscribe/ → Email subscription (Resend)
│   │   ├── components/        → FarmView, BagView, ExploreView, TabBar, FarmCanvas
│   │   ├── hooks/
│   │   │   └── usePolling.ts  → 30s polling hook (visibility-aware)
│   │   ├── canvas/            → Pixel art rendering engine
│   │   │   ├── palette.ts     → Color palette
│   │   │   ├── sprites.ts     → 16×16 sprite data (defined in code)
│   │   │   └── renderer.ts    → FarmRenderer class (Canvas 2D, footprints, water anims)
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

### API Auth Model

- **Web routes**: Authenticated via `cf_session` httpOnly cookie (set during OAuth callback)
- **CLI/VSCode routes**: No session cookie; send `github_id` in request body as fallback
- **Server**: Extracts user ID from session cookie first, falls back to body `github_id`/`from`
- **Validation**: Body-based auth validates the user exists in Redis (prevents arbitrary ID spoofing)
- **Read-only routes** (`GET /api/farm/[id]`, `GET /api/explore`): No auth required (public data)

## i18n

- Default: English. Korean when locale is `ko`.
- **Web**: Auto-detect via `navigator.language` + EN/KO toggle in footer
- **VSCode**: Auto-detect via `vscode.env.language` + `claudeFarmer.language` setting (auto/en/ko)
- **CLI**: Auto-detect via `$LANG` env var + `claude-farmer config --lang ko|en`
- Shared translation module: `shared/src/i18n.ts`

## Web UI Screens (4)

1. **Farm** — Canvas 2D pixel art (256×192, 4× scale), time-based background, notifications
2. **Codex** — Rarity-grouped progress bars + item grid (obtained/locked)
3. **Explore** — Neighbor list + random visit + watering (3/day) + bookmarks
4. **Farm Visit** — View another user's farm, water crops, toggle bookmark

## API Routes

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/auth/login` | GET | Start GitHub OAuth |
| `/api/auth/callback` | GET | OAuth callback (cookie, CLI redirect, or VSCode URI) |
| `/api/auth/session` | GET | Get current session user |
| `/api/auth/logout` | POST | Delete session cookie |
| `/api/farm/sync` | POST | CLI → server full profile sync (inventory, activity, stats) |
| `/api/farm/status` | POST | Update own status message (session/body auth) |
| `/api/farm/[id]` | GET | Public profile lookup (includes footprints) |
| `/api/farm/[id]/notifications` | GET | Farm notifications (visitors, water received) |
| `/api/farm/[id]/visit` | POST | Record farm visit (session auth) |
| `/api/water` | POST | Water a user's farm (3/day limit, optional crop_slot) |
| `/api/explore` | GET | Random user discovery |
| `/api/bookmarks` | GET | List bookmarked user profiles (session auth) |
| `/api/bookmarks` | POST | Add/remove bookmark (session auth) |
| `/api/subscribe` | POST | Email subscription + welcome email |

## Social System ("Ghost Visits")

- **Polling-based**: 30-second interval, pauses when tab is hidden
- **Footprints**: Visitors leave fading marks on your farm (24h TTL, Canvas-rendered between ground and crops)
- **Footprint position**: Deterministic via `hash(visitor_id + farm_id)` — no server storage needed
- **Water bonus**: Water log recorded server-side, actual growth applied on CLI's next turn (no sync conflict)
- **Notifications**: CLI shows social notifications on `claude-farmer farm`; Web polls `/notifications`
- **Hover tooltip**: Mouse over footprints shows visitor nickname + time
- **Redis keys**: `farm:{id}:visitors` (sorted set), `farm:{id}:footprints` (hash), `farm:{id}:water_detail:{date}` (sorted set)

## Farmer Title (Activity Badge)

Daily coding activity (input chars) determines a fun title displayed on the farm:

| Chars | Emoji | EN | KO |
| ----- | ----- | -- | -- |
| 0 | 😴 | Resting Farmer | 휴식 중인 농부 |
| 500+ | 🌱 | Strolling Farmer | 산책하는 농부 |
| 2,000+ | 🧑‍🌾 | Diligent Farmer | 부지런한 농부 |
| 5,000+ | 🔥 | Blazing Farmer | 열혈 농부 |
| 10,000+ | ⚡ | Legendary Farmer | 전설의 농부 |

- Helper: `getFarmerTitle()` in `shared/src/constants.ts`
- Shown on own farm (FarmView) and when visiting others (FarmVisitView)
- Resets daily with activity stats

## Data Sync (CLI → Server → Web)

CLI syncs full state to server via `/api/farm/sync`:

| Field | Source | Server Storage |
| ----- | ------ | -------------- |
| `farm_snapshot` (grid, level) | CLI local state | `PublicProfile` in Redis |
| `inventory` | CLI local state | `PublicProfile.inventory` |
| `unique_items` | Computed from inventory | `PublicProfile.unique_items` |
| `streak_days` | CLI activity tracking | `PublicProfile.streak_days` |
| `today_input_chars` | CLI activity tracking | `PublicProfile.today_input_chars` |
| `today_harvests` | CLI activity tracking | `PublicProfile.today_harvests` |
| `today_water_given` | CLI activity tracking | `PublicProfile.today_water_given` |
| `status_message` | CLI/Web/VSCode | `PublicProfile.status_message` |

Web reads from server on login and polls every 30s. VSCode reads local state directly.

## Boost Time (21:00–06:00)

- **2× growth**: Crops advance 2 stages per turn during boost hours
- **2× planting**: Plant every 2 turns instead of 3
- **Boosted gacha**: Common 53%, Rare 33%, Epic 12%, Legendary 2%
- **Visual**: Character afterimage (purple tint), pulsing gold "BOOST" badge, enhanced night palette
- Helper: `isBoostTime()` and `BOOST_MULTIPLIER` in `shared/src/constants.ts`

## Bookmarks

- **Redis set**: `user:{id}:bookmarks` stores bookmarked user IDs
- **API**: `GET /api/bookmarks` (list), `POST /api/bookmarks` (add/remove)
- **UI**: Star toggle on farm visit screen, bookmarked farms shown in Explore tab

## Visual Effects System (Canvas)

The FarmRenderer exposes trigger methods for rich visual feedback:

- **FloatingText**: Rising, fading text ("+1", "+2") on growth/harvest
- **Particle**: Colored particles for planting (dirt), harvesting (rarity color), legendary (gold burst)
- **ScreenFlash**: Full-canvas color flash on legendary harvest
- **ShakeEffect**: Per-slot crop shake on growth
- **LevelUpBanner**: Centered banner on level-up events
- **WaterAnim**: Blue droplet animation on watered slots

FarmCanvas exposes these via `forwardRef`/`useImperativeHandle` so parent components (FarmView, FarmVisitView) can trigger them on game events.

## Design Principles

- Zero user effort required. Install and forget — your farm grows on its own.
- Cute, cozy pixel art. Warm color palette.
- Minimal social = status bubble + watering + bookmarks + ghost visits. Warm but low-pressure.

## Deployment

- **Web**: Vercel → claudefarmer.com
- **CLI**: npm → `npm install -g claude-farmer` (v0.3.0)
- **VSCode**: Marketplace → `doribear.claude-farmer-vscode` (v0.3.0)
- **CI/CD**: GitHub Actions (push to main → build + lint)
