# Contributing to Claude Farmer

Thanks for your interest in making Claude Farmer better! Whether it's a bug fix, a new gacha item, a better sprite, or a wild feature idea — we'd love to have you.

Before contributing, please read [INVARIANTS.md](INVARIANTS.md) to understand the project's principles and constraints.

## Quick Start

```bash
# Clone and install
git clone https://github.com/claude-farmer/claude-farmer.git
cd claude-farmer
npm install

# Build everything (shared must build first)
npx turbo run build

# Run the web app locally
cd packages/web
cp .env.example .env.local   # Fill in your credentials
npm run dev

# Run the CLI in dev mode
cd packages/cli
npm run dev

# Run the VSCode extension
cd packages/vscode
npm run dev
```

### Environment Setup (Web)

The web app requires a few services. See `packages/web/.env.example` for the full list:

- **GitHub OAuth**: Create an OAuth app at [github.com/settings/developers](https://github.com/settings/developers)
- **Upstash Redis**: Free tier at [upstash.com](https://upstash.com)
- **Resend** (optional, for emails): Free tier at [resend.com](https://resend.com)

## Project Structure

```text
claude-farmer/
├── shared/              → @claude-farmer/shared (types, constants, gacha, i18n)
├── packages/
│   ├── cli/             → claude-farmer (npm CLI)
│   ├── web/             → claudefarmer.com (Next.js)
│   └── vscode/          → VSCode extension
├── CLAUDE.md            → AI context file (for Claude Code)
├── INVARIANTS.md        → Project principles & constraints
└── CONTRIBUTING.md      → You are here
```

## How to Contribute

### Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, CLI/Web/VSCode)

### Suggesting Features

Open an issue with the `enhancement` label. Before proposing, check [INVARIANTS.md](INVARIANTS.md):
- Does it add joy to coding? (mission)
- Does it work on free tier? (cost constraint)
- Does it require zero user effort? (design principle)

### Pull Requests

1. **Fork and branch** from `main`
2. **Keep it small** — one feature or fix per PR
3. **Build passes**: Run `npx turbo run build` before pushing
4. **i18n**: If adding user-facing strings, add both `en` and `ko` translations in `shared/src/i18n.ts`
5. **Types in shared**: New types go in `shared/src/types.ts`, constants in `shared/src/constants.ts`
6. **Test locally**: For web changes, test with `npm run dev`. For CLI, test with `npm run dev` in the CLI package.

### Code Style

- **TypeScript** for all code
- **No raw magic numbers** — use constants from `shared/src/constants.ts`
- **Keep it simple** — the codebase should be approachable for beginners
- **Pixel art assets** are defined in code (`packages/web/canvas/sprites.ts`), not image files

### Commit Messages

Use clear, descriptive commit messages:

```
Add new gacha item: Golden Sunflower
Fix water count not resetting at midnight
Update Korean translations for social features
```

## Areas Where Help is Wanted

- New gacha items (sprites + translations)
- Better pixel art sprites
- Accessibility improvements
- Additional language translations
- CLI experience improvements
- VSCode extension polish

## Code of Conduct

Be kind. This is a cozy farming game, not a battleground. Treat each other the way you'd want your farm neighbors to treat you.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
