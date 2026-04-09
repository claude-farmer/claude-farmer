# CLAUDE.md — Claude Farmer

> Context file for Claude Code (or other LLMs) to quickly understand the project.

## One-Line Summary

An **idle pixel-art farming game** where your farm grows automatically as you use Claude Code. Visit other developers' farms, water their crops, and bookmark favorites.

## Tech Stack

- **Monorepo**: npm workspaces + Turborepo
- **Language**: TypeScript (all packages)
- **CLI**: Node.js, Commander, Chalk, esbuild (single CJS bundle)
- **Web**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Canvas 2D
- **VSCode**: Extension API, esbuild, Webview panel embedding claudefarmer.com (iframe)
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
│       ├── constants.ts → Config values (GRID_SIZE, RARITY_WEIGHTS, level calc, farmer titles, evolution tiers)
│       ├── gacha.ts     → 32 gacha items + rollGacha() with diminishing returns + getItemCounts()
│       └── i18n.ts      → Translation dict (en/ko), detectLocale(), t() helper
├── packages/
│   ├── cli/             → claude-farmer (npm package, global install)
│   │   └── src/
│   │       ├── index.ts       → CLI entry (Commander routing)
│   │       ├── commands/      → init, status, bag, open, water, watch, farm, config, guestbook, rankings, gift, character, visit, search, bookmark
│   │       ├── core/state.ts  → Local state CRUD (~/.claude-farmer/)
│   │       ├── core/config.ts → Language config (~/.claude-farmer/config.json)
│   │       ├── core/farm.ts   → Plant/grow/harvest/gacha core loop
│   │       ├── lib/open-url.ts→ Cross-platform URL opener (child_process)
│   │       ├── detect/        → Claude Code activity detection (fs.watch)
│   │       └── sync/          → Server sync (claudefarmer.com API)
│   ├── web/             → @claude-farmer/web (Next.js, claudefarmer.com)
│   │   ├── app/               → Next.js App Router pages
│   │   │   ├── page.tsx       → Landing page (subscribe form, EN/KO toggle, SearchModal CTA)
│   │   │   ├── farm/          → /farm redirects to /@me for logged-in users
│   │   │   ├── (profile)/[username]/
│   │   │   │   ├── layout.tsx → Server: generateMetadata + ProfilePage JSON-LD
│   │   │   │   ├── page.tsx   → Profile page (Card-based, modals, replaces old tabs)
│   │   │   │   └── og/route.tsx → Per-user OG image (Satori, edge runtime)
│   │   │   ├── og/            → Site-wide default OG image
│   │   │   ├── sitemap.ts     → Dynamic sitemap incl. active profiles from Redis
│   │   │   ├── robots.ts      → robots.txt + sitemap reference
│   │   │   ├── not-found.tsx  → 404 → redirect to home
│   │   │   └── api/
│   │   │       ├── auth/      → login, callback (GitHub OAuth), session, logout
│   │   │       ├── farm/      → sync, status, [id] (profile+footprints), [id]/notifications, [id]/visit, [id]/guestbook, [id]/rankings
│   │   │       ├── water/     → Watering (5-min cooldown), water/cooldown (GET remaining)
│   │   │       ├── gift/      → Gift gacha items to other farms
│   │   │       ├── bookmarks/ → List/toggle bookmarks
│   │   │       ├── explore/   → Random + recent user discovery + search
│   │   │       └── subscribe/ → Email subscription (Resend)
│   │   ├── middleware.ts      → Rewrites /@username → /[username]
│   │   ├── components/        → Card primitive, FarmCanvas, FarmThumbnail, GuestbookPanel, GuestbookModal, RankingsModal, ShareCanvas, ShareModal, SearchModal, AboutModal, StatusEditModal, MenuDropdown, GiftPicker, BagView, DiscoverCarousel, CharacterEditor, Icon
│   │   ├── hooks/
│   │   │   └── usePolling.ts  → 30s polling hook (visibility-aware)
│   │   ├── canvas/            → Pixel art rendering engine
│   │   │   ├── palette.ts     → Color palette
│   │   │   ├── sprites.ts     → 16×16 sprite data (defined in code)
│   │   │   ├── character.ts   → composeCharacterSprite (pure)
│   │   │   ├── renderer.ts    → FarmRenderer class (FarmCanvas, footprints, water anims)
│   │   │   ├── thumbnailScene.ts → 64×64 thumbnail pure draw fn (shared by FarmThumbnail + ShareCanvas)
│   │   │   └── thumbnailRects.ts → CanvasRecorder shim → rect list (used by Satori OG route)
│   │   └── lib/
│   │       ├── redis.ts       → Upstash Redis client (lazy init) + key namespaces
│   │       ├── session.ts     → HMAC-signed session sign/verify + extractUserId
│   │       ├── api.ts         → Client API functions (session, farm, water, rankings, etc.)
│   │       ├── i18n.ts        → Web-specific translation dict + detectLocale()
│   │       └── locale-context.tsx → React context provider + useLocale() hook
│   └── vscode/          → claude-farmer-vscode (VSCode Marketplace)
│       ├── src/extension.ts   → Thin wrapper (~380 lines): activity detection, sync, OAuth URI handler, FarmSidebarProvider (claudefarmer.com webview in sidebar)
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
5. Items auto-registered in codex (32 items total)

## Gacha Diminishing Returns

As collection progress increases, the chance of getting a duplicate item rises exponentially:

- Formula: `duplicateBias = collectionRatio ^ 1.5`
- 0% collected: 0% bias (normal odds)
- 50% collected: ~35% chance of duplicate
- 75% collected: ~65% chance of duplicate
- 90% collected: ~85% chance of duplicate
- `rollGacha(boost, ownedItemIds?)` in `shared/src/gacha.ts`

## Item Evolution (★ System)

Collecting duplicates of the same item triggers automatic evolution tiers:

| Copies | Grade | Display |
| ------ | ----- | ------- |
| 1 | Base | (no star) |
| 3 | ★ | Bronze star |
| 7 | ★★ | Silver stars |
| 15 | ★★★ | Gold stars |

- Computed on-the-fly from `inventory` array — no stored evolution state
- Helpers: `getEvolutionTier()`, `getNextEvolutionThreshold()` in `shared/src/constants.ts`
- `getItemCounts()` in `shared/src/gacha.ts` counts duplicates per item ID
- Web codex: star badge + count on tiles, progress bar + next threshold in modal
- CLI codex: `[ItemName ★ ×5]` format

## Auth Flows

### Web (Session Cookie)

1. `/api/auth/login` → GitHub OAuth consent screen
2. `/api/auth/callback` → token exchange → save profile in Redis → set `cf_session` httpOnly cookie
3. `/farm` page → fetch user from `/api/auth/session` → render real data

### CLI (Local Callback Server)

1. `claude-farmer init` → open GitHub OAuth in browser
2. OAuth complete → redirect to `localhost:19274/callback`
3. Receive user info → create `~/.claude-farmer/state.json`

### VSCode (URI Handler + Sidebar WebviewView)

1. Sidebar (`claudeFarmer.farmView`) auto-loads when visible — no button click needed
2. If logged in: extension calls `POST /api/auth/vscode-session` → receives one-time token URL (60s TTL, HMAC-signed) → navigates sidebar iframe to that URL → server sets `cf_session` cookie in webview context → redirects to `/@github_id`
3. If not logged in: webview shows login page → user clicks "Login with GitHub" → extension opens external browser for OAuth → OAuth complete → `vscode://doribear.claude-farmer-vscode/callback?...` → extension creates local state + calls `navigateToFarm()` on the sidebar
4. After auth, claudefarmer.com runs fully inside the VSCode sidebar (iframe)
5. `claudeFarmer.openFarm` command focuses the sidebar (`claudeFarmer.farmView.focus`)

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

## Web UI (Profile-Page Centric)

The web app is built around a single profile page at `/@username` (rewritten via middleware to `/(profile)/[username]`). Old tab-based UI removed in favor of one scrollable Card-based page + bottom-sheet modals.

### Profile Page Cards (Header / Body / Footer pattern)
1. **Today** (own farm only, top, conditional) — input chars / harvests / water given
2. **Profile Card** — header: 농부 칭호 + 🔥 streak / right: carved-out 🔖 bookmark · body: chat-style status bubble (avatar + nickname · time + rounded bubble + link footer) · footer: ✏️ edit (own) or none
3. **Records** — 4-col stats row (Harvests / Codex % / Visitors / Watered)
4. **Compact Codex** (own only) — single-line emoji preview + "View all"
5. **Guestbook** — chat-style entries (max 5, grouped consecutive same-user) · header right: count chips (🎁 / 💧 / ✍️) → modal · footer: 💧 water + 🎁 gift (visit only) · body hint
6. **DiscoverCarousel** — Neighbors / Discover thumbnails

### Bottom-Sheet Modals
- **SearchModal** — Recent (3) / Discover (6) / Neighbors / search by GitHub ID or nickname
- **ShareModal** — Client-side `<ShareCanvas>` (800×800 PNG) + copy/save/share
- **GuestbookModal** — Full scrollable entry list
- **RankingsModal** — Per-user water/gift cumulative ranking (tabs)
- **AboutModal**, **StatusEditModal**, **CharacterEditor**, **GiftPicker**, **BagView** (codex)

### Header Navigation (h-8 GitHub-style outline)
- Left: hamburger (app menu: About, Language) + visited profile (avatar + nickname + Lv)
- Right: search · share · my-account avatar (account menu: Edit, Character, Logout) or Login button

## VSCode Extension

The extension is a **thin wrapper** (~380 lines) around claudefarmer.com. It no longer maintains its own UI — instead it embeds the full web app in the VSCode sidebar as a `WebviewView`.

**What the extension does:**
- Detects editor activity (text changes, file saves, terminal switches) → runs game loop → syncs to server
- Handles GitHub OAuth via `vscode://` URI handler → creates `~/.claude-farmer/state.json`
- Renders claudefarmer.com in the sidebar (`FarmSidebarProvider`, `WebviewView`) — auto-loads on open, no button needed
- Authenticates the webview via one-time HMAC token (`POST /api/auth/vscode-session`)

**Why this approach (v0.4.0 rewrite rationale):**
- Previous: 2011-line file with inline HTML/CSS/JS, duplicating all web features
- Problem: every new web feature had to be re-implemented in the extension; bugs like `status_message` being reset by sync were caused by the split state
- Solution: extension only handles what requires native VSCode APIs; all UI lives in the web

**Sidebar:** claudefarmer.com loads directly in the sidebar panel as soon as it becomes visible.

**Known fix (v0.4.1):** sidebar button was named `open()` — colliding with `window.open()` — causing VSCode to freeze on click. Renamed to `openFarm()`. Also removed `allow-top-navigation` and `allow-modals` from iframe sandbox to prevent renderer hangs.

**`next.config.ts`:** sets `Content-Security-Policy: frame-ancestors 'self' vscode-webview: vscode-file:` to allow claudefarmer.com pages to be framed by VSCode webviews.

## API Routes

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/auth/login` | GET | Start GitHub OAuth |
| `/api/auth/callback` | GET | OAuth callback (cookie, CLI redirect, or VSCode URI) |
| `/api/auth/session` | GET | Get current session user |
| `/api/auth/logout` | POST | Delete session cookie |
| `/api/auth/vscode-session` | POST | VSCode webview auth: validate github_id → return one-time HMAC token URL (60s TTL) |
| `/api/auth/vscode-session` | GET `?token&gid&ts` | Verify token → set `cf_session` cookie in webview context → redirect to `/@gid` |
| `/api/farm/sync` | POST | CLI → server full profile sync (inventory, activity, stats) |
| `/api/farm/status` | POST | Update own status message (session/body auth) |
| `/api/farm/[id]` | GET | Public profile lookup (incl. footprints, total_visitors/bookmarks/water) |
| `/api/farm/[id]/notifications` | GET | Farm notifications (visitors, water received) |
| `/api/farm/[id]/visit` | POST | Record farm visit (always increments visit count) |
| `/api/farm/[id]/guestbook` | GET | Guestbook entries (annotated with `liked` for owner) + total_water + total_gifts |
| `/api/farm/[id]/guestbook` | DELETE | Owner only: bulk delete (no body) or individual delete (`body.at` + `body.from_id`) |
| `/api/farm/[id]/guestbook/like` | POST | Owner only: toggle ♥ on an entry (`body.at`) → stored in `farm:{id}:guestbook_liked` |
| `/api/farm/[id]/rankings` | GET | Per-user water/gift cumulative ranking (top 20) |
| `/api/water` | POST | Water a user's farm (5-min cooldown, sender link snapshot) |
| `/api/water/cooldown` | GET | Current user's water cooldown remaining seconds |
| `/api/gift` | POST | Gift a gacha item (sender link snapshot, gift count incr) |
| `/api/bookmarks` | GET | List bookmarked profiles + neighbor flag (session auth) |
| `/api/bookmarks` | POST | Add/remove bookmark + total_bookmarks counter |
| `/api/explore` | GET | User discovery (`?sort=random` or `?sort=recent`, default random) |
| `/api/explore/search` | GET | Search users by GitHub ID or nickname |
| `/api/subscribe` | POST | Email subscription + welcome email |
| `/[username]/og` | GET | Per-user OG card (Satori, edge runtime, ASCII-safe text + pixel art via CanvasRecorder shim) |
| `/api/og/random` | GET | Stream a random active user's OG card (used by README embed; cache 10 min so GitHub Camo rotates over time) |

All API routes (web/CLI/VSCode) use `extractUserId(request, bodyFrom?)` from `lib/session.ts` — verifies HMAC-signed `cf_session` cookie first, falls back to body `from`/`github_id` for CLI/VSCode.

## Social System ("Ghost Visits")

- **Polling-based**: 30-second interval, pauses when tab is hidden
- **Footprints**: Visitors leave fading marks on your farm (24h TTL, Canvas-rendered between ground and crops)
- **Footprint position**: Deterministic via `hash(visitor_id + farm_id)` — no server storage needed
- **Water bonus**: Water log recorded server-side, actual growth applied on CLI's next turn (no sync conflict)
- **Notifications**: CLI shows social notifications on `claude-farmer farm`; Web polls `/notifications`
- **Hover tooltip**: Mouse over footprints shows visitor nickname + time
- **Redis keys**:
  - `farm:{id}:visitors` (sorted set, 24h)
  - `farm:{id}:footprints` (hash, 24h)
  - `farm:{id}:water_detail:{date}` (sorted set, daily)
  - `farm:{id}:guestbook` (sorted set, max 100, includes link snapshot)
  - `farm:{id}:total_visitors` (counter, increments every visit)
  - `farm:{id}:total_water_received` (counter)
  - `farm:{id}:total_gifts_received` (counter)
  - `farm:{id}:total_bookmarks` (counter, ±1 on bookmark add/remove)
  - `farm:{id}:water_by_user` (sorted set, member=user_id score=count, ranking)
  - `farm:{id}:gifts_by_user` (sorted set, member=user_id score=count, ranking)
  - `farm:{id}:gifts` (hash, item_id → count)
  - `farm:{id}:guestbook_liked` (set, member=entry.at ISO string — entries owner has ♥'d)
  - `user:{id}:bookmarks` (set)
  - `user:{id}:water_cooldown` (string, 5min TTL)
  - `global:recent_active` (sorted set, score=last_active timestamp, used by sitemap & explore)
- **Nickname index**: `global:nickname_index` (hash, `nickname_lowercase → github_id`) — updated on sync, used for user search

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
- Shown on the unified profile page (own farm and visited farms)
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

**`status_message` sync safety (v0.4.0 fix):** `/api/farm/sync` previously overwrote server `status_message` with `null` whenever CLI/VSCode synced without a local status set. Fixed: if incoming `status_message` is null, the existing server value is preserved (`existing?.status_message ?? null`). This prevents web/VSCode edits from being silently reset on the next activity sync.

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

## Guestbook (방명록)

- Chat-style log of visit/water/gift records, rendered with avatar + name·time + speech bubble
- Each entry stores a snapshot of visitor's `status_message.text` AND `status_message.link` at action time (`GuestbookEntry.message` + `link?`)
- Card body limited to 5 entries; full list via `GuestbookModal` opened from header `✍️ N` chip
- Header right also shows `🎁 N` (total gifts) and `💧 M` (total water) chips → opens `RankingsModal`
- Consecutive same-user same-content entries grouped: type counts shown as `🎁 ×3 · 💧 ×2`
- Body footer: `💧 water` + `🎁 gift` action buttons (visit + logged-in)
- Body bottom hint encouraging visit/water/gift interaction
- Redis: `farm:{id}:guestbook` (sorted set, max 100 entries, newest first)
- API: `GET /api/farm/[id]/guestbook` returns entries + `total_water_received` + `total_gifts_received`

### Guestbook Owner Actions (v0.4.0)

Farm owner (and only the owner) can manage their own guestbook:

- **전체 삭제 (Clear all)**: Web modal header button · CLI `claude-farmer guestbook --clear`
- **개별 삭제 (Delete entry)**: Web hover 🗑️ per entry · CLI `claude-farmer guestbook --delete` (interactive numbered list)
- **개별 좋아요 (Like entry)**: Web hover ♥ toggle (red when liked) · CLI `claude-farmer guestbook --like` (interactive)

Liked state stored in `farm:{id}:guestbook_liked` (Redis SET of `entry.at` ISO strings). `GET /api/farm/[id]/guestbook` annotates each entry with `liked: boolean` when the caller is the owner (session cookie or `github_id` body matches `id`). Liking does not affect other users' views — it is a private owner-side marker.

## Per-User Rankings

- Cumulative water/gift contributions tracked in sorted sets (`farm:{id}:water_by_user`, `farm:{id}:gifts_by_user`)
- `ZINCRBY` on each water/gift action
- `GET /api/farm/[id]/rankings` returns top 20 contributors per category with profile enrichment
- `RankingsModal` (water/gifts tabs) accessible from guestbook count chips
- Spirit: thank-you wall, not competitive leaderboard (see INVARIANTS decision log)

## Gift System (선물)

- Send gacha items from inventory to other farms as "likes"
- Deducts from sender's server-side inventory
- Recipient accumulates gifts: `farm:{id}:gifts` (hash, item_id → count)
- Gift counts affect farm decoration visuals (3→glow, 7→sparkle, 15→gold border)
- Recorded in guestbook as type "gift"

## Neighbors (이웃)

- Mutual bookmarks automatically detected as "neighbors" (이웃)
- Bookmarks API returns `is_neighbor: boolean` via `SISMEMBER` check
- Explore tab shows 🏡 Neighbors section above regular bookmarks

## Farm Decorations

- Collected gacha items appear as 6×6 pixel art on farm grass areas
- 16 decoration slots (8 left, 8 right of grid), rarity-prioritized
- Gift accumulation upgrades: 1→appear, 3→glow, 7→particles, 15→gold border
- Total water received increases flower density (10+ / 50+ thresholds)

## Streak Bonfire

- Visual campfire on farm based on `streak_days`:
  - 1d: ember, 3d: small flame, 7d: campfire + particles, 14d: large fire, 30d+: blue flame
- Rendered at farm right-bottom grass area, visible to visitors

## Micro Weather

- Deterministic daily weather per farm: `hash(userId + dateString) % 100`
- Clear (70%), Rain (15%), Snow (8%), Fog (5%), Aurora (2%, night only)
- Purely visual — no gameplay effects
- Helper: `getFarmWeather()` in `shared/src/constants.ts`

## Share / OG Image System

Two parallel rendering paths share the same 64×64 pixel-art scene logic but target different runtimes:

### `canvas/thumbnailScene.ts` (pure)
- `prepareThumbnailScene(opts)` + `renderThumbnailFrame(ctx, scene, frame)`
- Draws character + background + items + decorations + tier border using `fillRect` calls
- Reused by `FarmThumbnail.tsx`, `ShareCanvas.tsx`, and indirectly by `thumbnailRects.ts`

### Client-side share image (`components/ShareCanvas.tsx`)
- 800×800 PNG generated in browser via Canvas2D
- 64×64 thumbnail rendered offscreen, then 8× nearest-neighbor blit (512×512) onto the share canvas
- Adds nickname/stats/URL with system fonts (CJK/emoji safe)
- Exposes `getBlob()` via `useImperativeHandle` for `ShareModal` download / `navigator.share({files})`

### Server-side OG image (`app/(profile)/[username]/og/route.tsx`)
- Edge runtime + `next/og` ImageResponse (Satori under the hood)
- Satori cannot run Canvas2D, has fragile CSS support, and silently fails on CJK text / external `<img>` / `filter: blur()` / italic / letterSpacing
- **Workaround**: `canvas/thumbnailRects.ts` defines a `CanvasRecorder` shim with the same interface as `CanvasRenderingContext2D` (`fillStyle`/`fillRect`/`clearRect`/`globalAlpha`/`createLinearGradient`). `renderThumbnailFrame()` is run against this recorder, accumulating ~200-400 `{x,y,w,h,color,opacity}` rects. The route then renders each rect as an absolute-positioned `<div>` in the Satori JSX
- ASCII-safe text (`asciiSafe()` strips non-ASCII), no external images, all div with explicit `display: 'flex'`
- Cache-Control short TTL (1 hour, not 1 year) so any failure self-heals; cache-buster `?v={last_active}` in metadata URL
- Fallback handler returns a generic Claude Farmer card if profile is missing
- Layout: 550×550 rounded-square thumbnail card on the right, left text group (nickname 1.5× / @username 1.3× / blockquote-style status 1× with yellow left border), bottom-left URL, sky-theme gradient background
- See [docs/PROFILE_REDESIGN_LOG.md](docs/PROFILE_REDESIGN_LOG.md) for the full iteration history and Satori failure modes

### Profile Page Metadata (`app/(profile)/[username]/layout.tsx`)
- Server component exporting `generateMetadata` with per-user title (50–60 chars) / description (110–160 chars) / `openGraph` / `twitter` cards
- Default export injects ProfilePage JSON-LD (`mainEntity: Person { name, image, identifier }` + `primaryImageOfPage`) for Google Search thumbnail signal
- `og:image` URL: `/{username}/og?v={last_active timestamp}`

### Sitemap (`app/sitemap.ts`)
- Pulls top 1000 active users from `global:recent_active` sorted set
- Emits `/@{id}` entries with `lastModified = last_active`
- 1-hour `revalidate`

## Visual Effects System (Canvas)

The FarmRenderer exposes trigger methods for rich visual feedback:

- **FloatingText**: Rising, fading text ("+1", "+2") on growth/harvest
- **Particle**: Colored particles for planting (dirt), harvesting (rarity color), legendary (gold burst)
- **ScreenFlash**: Full-canvas color flash on legendary harvest
- **ShakeEffect**: Per-slot crop shake on growth
- **LevelUpBanner**: Centered banner on level-up events
- **WaterAnim**: Blue droplet animation on watered slots

FarmCanvas exposes these via `forwardRef`/`useImperativeHandle` so the profile page can trigger them on game events.

## Design Principles

- Zero user effort required. Install and forget — your farm grows on its own.
- Cute, cozy pixel art. Warm color palette.
- Rich social = guestbook + watering + gifting + neighbors + ghost visits. Warm but low-pressure.

## Documentation

```text
CLAUDE.md                          → LLM context (this file, must stay at root)
README.md                          → Project overview & install guide (must stay at root)
docs/
├── PIXEL_ART_STYLE_GUIDE.md      → Visual consistency rules for sprites & canvas rendering
├── CONTRIBUTING.md                → Contribution guidelines, PR process, code style
├── INVARIANTS.md                  → System invariants & assumptions that must not be broken
├── PROFILE_REDESIGN_LOG.md        → Iteration log for profile/share/OG redesign + Satori workarounds
└── SECURITY.md                    → Security policy & vulnerability reporting
.private/
└── claude-farmer-spec.md          → Internal design spec (not committed to public repo)
```

## Deployment

- **Web**: Vercel → claudefarmer.com (auto on `main` push)
- **CLI**: npm → `npm install -g claude-farmer` (v0.4.3)
- **VSCode**: Marketplace → `doribear.claude-farmer-vscode` (v0.4.3)
- **CI/CD**: GitHub Actions (push to main → build + lint)

### Release Commands

```bash
# Bump versions in shared/cli/vscode/web package.json + cli/src/index.ts + vscode hardcoded v0.x.y + web layout.tsx softwareVersion + CLAUDE.md (keep all aligned)

# Build everything
npx turbo run build

# Publish CLI to npm
(cd packages/cli && npm publish --access public)

# Publish VSCode to Marketplace
# IMPORTANT: --no-dependencies prevents vsce from climbing the monorepo .git
# and pulling sibling packages/cli + packages/web (300MB+) into the .vsix.
(cd packages/vscode && vsce publish --no-dependencies)

# Web deploys automatically via Vercel on `main` push
```

**Pre-release checklist:**
- All 8 version locations aligned (shared, web, cli pkg+index.ts, vscode pkg+extension.ts hardcoded, web layout.tsx softwareVersion, CLAUDE.md)
- `npx turbo run build` green
- `git status` clean, pushed to main
- Vercel build passing (check dashboard)
- VSCode publisher PAT not expired (90-day default)
