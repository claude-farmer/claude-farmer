# INVARIANTS.md — Project Principles & Constraints

This document defines the non-negotiable principles and constraints for Claude Farmer. Every contributor (human or AI) should read this before making changes.

## Mission

Claude Farmer exists to **add a little joy to using Claude Code**. That's it. It's a tiny idle game that runs in the background while you work. No productivity features, no analytics, no upselling — just a cozy farm that grows as you code.

## Non-Profit Orientation

This project is **non-profit by intention**. We don't monetize users, collect data for profit, or gate features behind paywalls. Everything is free, open-source, and community-driven.

### Cost Constraints

Because this project generates zero revenue, **infrastructure costs must stay near zero**.

| Tier | Rule | Examples |
|------|------|---------|
| **Free only** | Default for all services. If there's a free tier, use it. | Vercel free, Upstash free tier, GitHub Actions free minutes |
| **Minimal cost OK** | Only when a genuinely great improvement requires it, and the team agrees. Must be documented. | A small Redis upgrade for higher throughput, a CDN for assets |
| **Never** | Recurring costs that scale with users. Per-user pricing. Paid SaaS dependencies. | Paid databases, paid auth providers, paid monitoring |

**Before adding any dependency or service**, ask: "Does this work on the free tier?" If no, it needs explicit team approval with a written justification.

## Platform Scope

### Current Platform
- **Claude Code** (CLI tool by Anthropic) is the primary integration point

### Extensible
- The Claude Code platform coupling is **not a hard boundary**. Extensions to other AI coding tools, editors, or developer environments are welcome — as long as they align with the mission ("add joy to coding") and don't compromise the core experience.

### Not In Scope
- General-purpose farming games unrelated to coding
- Productivity tools, time trackers, or analytics dashboards
- Anything that requires user effort (the farm should grow on its own)

## Technical Invariants

### Architecture
- **Monorepo**: npm workspaces + Turborepo. All packages live in this repo.
- **Shared package first**: Types, constants, gacha logic, and i18n live in `shared/`. Never duplicate these in packages.
- **Local-first**: The CLI stores state locally (`~/.claude-farmer/`). Server sync is optional and best-effort.

### Data & Privacy
- **Minimal data collection**: Only what's needed to display a public farm profile (nickname, avatar, farm state, level).
- **No tracking**: No analytics, no telemetry, no user behavior logging.
- **No PII beyond GitHub public profile**: We store `github_id`, `nickname`, and `avatar_url` — all publicly available on GitHub.
- **24-hour TTL on social data**: Footprints, visitor logs, and water records auto-expire. We don't build a permanent social graph.

### Code Quality
- **TypeScript everywhere**: All packages use TypeScript. No raw JavaScript files.
- **Shared constants**: Magic numbers (grid size, water limit, rarity weights) live in `shared/src/constants.ts`, not scattered across files.
- **i18n for all user-facing strings**: Support English and Korean at minimum. Use the shared translation system (`shared/src/i18n.ts`).
- **No breaking changes to local state**: `~/.claude-farmer/state.json` migrations must be backward-compatible. Users should never lose their farm.

### Design
- **Zero effort**: The game must work without any user interaction beyond initial setup.
- **Cozy, not competitive**: No global leaderboards, no public rankings of all users, no pressure. Per-farm "thank-you walls" (top contributors who watered/gifted that specific farm) are allowed because they celebrate generosity, not winners. See decision log.
- **Lightweight social**: Status bubbles, watering, bookmarks, ghost visits. Nothing that creates obligation or FOMO.

## Decision Log

When a principle above is bent or extended, document it here with date and reason.

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-07 | Per-farm contributor rankings (water/gift) added via `RankingsModal` and `/api/farm/[id]/rankings` | Bends "no rankings" rule. Justification: it's a per-farm thank-you wall, not a global leaderboard. Lists who has watered/gifted *this specific farm*, celebrating generosity toward the owner. No global "best player" anywhere. Accessed only by clicking the count chip in the guestbook header — not surfaced by default. |
