# Pixel Art Style Guide — Claude Farmer

> Agent document for maintaining visual consistency across all pixel art rendering.
> All character, environment, and UI pixel art MUST follow this guide.

---

## 1. Design Philosophy

- **Chibi / Big-Head (대두) Style**: Characters have oversized round heads (60% of total height) and small stubby bodies
- **Round & Cute**: All shapes favor curves over sharp edges. Use stepped-pixel curves, never pure rectangles for organic forms
- **Warm & Cozy**: Soft pastel palette. No harsh contrasts. Shadows are tinted, not gray
- **Consistent Scale**: Everything is designed for a 256×192px canvas at 1:1 pixel scale
- **12fps Animation**: All animations target ~80ms frame interval. Bouncy, snappy timing

---

## 2. Character System Overview

### 2.1 Chibi Body Template (16×16px)

All characters share the **same body template**. Only the **head region** (rows 0–8) changes per character type.

```
Layout (16×16 grid):
┌──────────────────┐
│    ████████       │ row 0-1: head top (hair/ears/horns)
│   ██████████      │ row 2-3: head middle (face area)
│   ██████████      │ row 4-5: face features (eyes, nose, mouth, blush)
│   ██████████      │ row 6-7: head bottom (chin/jaw) + neck
│    ████████       │ row 8: neck/collar transition
│    ████████       │ row 9-10: torso (clothes)
│    ████████       │ row 11: waist
│    ████████       │ row 12-13: legs (pants)
│    ██  ████       │ row 14: feet (shoes)
│   ████████████    │ row 15: ground shadow
└──────────────────┘
```

**Head : Body ratio = ~8:8 pixels** (head occupies rows 0–7, body occupies rows 8–15)

### 2.2 Body Constants (Shared Across All Types)

These pixels are IDENTICAL for all character types:

| Part | Rows | Width | Color Key |
|------|------|-------|-----------|
| Clothes | 8-10 | 6px centered | `clothes` / `clothesShadow` |
| Pants | 11-13 | 6px centered | `pants` / `pantsShadow` |
| Shoes | 14 | 2px × 2 (gap) | `shoes` |
| Shadow | 15 | 8px centered | `shadow` |

### 2.3 Head Types

Characters are divided into two categories:

#### A. Human Heads
- **Structure**: Round face with hair on top, skin-colored face area
- **Variations**: Hair style (short, long, curly, ponytail, bun, spiky, bob), hair color, skin tone
- **Face features**: Eyes (round dot, line, star), optional glasses, blush marks
- **Size**: 8×8px head region (rows 0–7, cols 4–11)

#### B. Animal Heads
- **Structure**: Round face with animal features (ears, snout, whiskers)
- **Types**: Bear, Rabbit, Tiger, Wolf, Frog, Dog variants (Husky, Bichon, Welsh Corgi)
- **Key rule**: Animal heads use the SAME face grid positions for eyes (rows 4-5) so expressions align
- **Ears**: Extend into rows 0-1, may use cols 3 and 12 for wide ears (rabbit)
- **Size**: 8×8px base + optional ear extensions

---

## 3. Character Type Definitions

### 3.1 Human Variants

#### Hair Styles (top of head, rows 0-3)
| ID | Name | Description | Key Pixels |
|----|------|-------------|------------|
| `short` | Short Hair | Basic rounded top, 2px tall | Rows 0-1 filled, round edges |
| `long` | Long Hair | Falls to row 6 on sides | Side columns extend down |
| `curly` | Curly Hair | Bumpy outline, 3px tall | Irregular top edge |
| `ponytail` | Ponytail | Short top + tail right side | Extra pixels cols 11-12, rows 2-4 |
| `bun` | Hair Bun | Round bun on top | Extra 2×2 at rows -1 to 0 center |
| `spiky` | Spiky Hair | Sharp upward points | Alternating high/low pixels row 0 |
| `bob` | Bob Cut | Smooth round, covers ears | Wide at rows 2-3 |
| `buzz` | Buzz Cut | Very short, 1px | Only row 1, minimal |

#### Hair Colors
| ID | Hex | Description |
|----|-----|-------------|
| `brown` | `#5C3A1E` / `#7A5230` | Default brown (base/highlight) |
| `black` | `#2C1810` / `#3E2723` | Dark black |
| `blonde` | `#D4A543` / `#E8C468` | Golden blonde |
| `red` | `#A0522D` / `#CD853F` | Auburn/red |
| `pink` | `#E8A0BF` / `#F0C0D0` | Pink |
| `blue` | `#4A6FA5` / `#6B8FBF` | Blue |
| `white` | `#D0D0D0` / `#EEEEEE` | White/silver |
| `green` | `#5A9E5A` / `#7BC77B` | Green |

#### Face Accessories
| ID | Description | Pixels |
|----|-------------|--------|
| `none` | No accessory | — |
| `glasses` | Round glasses | 2×1 frames around each eye, bridge between |
| `sunglasses` | Dark glasses | Same as glasses but filled dark |
| `eyepatch` | Pirate eyepatch | Cover one eye, strap across |
| `bandaid` | Cute bandaid | Small cross on cheek |

#### Eye Styles
| ID | Description | Pixels |
|----|-------------|--------|
| `dot` | Simple dot | 1×1 per eye (default) |
| `round` | Round open | 1×2 per eye |
| `line` | Relaxed line | 2×1 horizontal per eye |
| `star` | Star eyes | 1×1 with sparkle pixels |
| `closed` | Happy closed | 1×1 arc shape |

### 3.2 Animal Variants

All animals follow this template:
- Rows 0-1: **Ears** (species-specific, may extend beyond 16px width)
- Rows 2-3: **Head top** (fur color, round shape)
- Rows 4-5: **Face** (eyes at same positions as humans + species features)
- Rows 6-7: **Snout/mouth** area (species-specific)

#### Animal Types

| ID | Name | Ear Shape | Face Feature | Base Color | Accent Color |
|----|------|-----------|-------------|------------|-------------|
| `bear` | Bear | Small round (2×2) | Round snout (2×2 light) | `#8B6544` | `#D4A574` |
| `rabbit` | Rabbit | Tall upright (2×4) | Pink nose dot | `#F5E6D3` | `#FFB6C1` |
| `tiger` | Tiger | Small round, striped | Stripes on cheeks | `#E8A040` | `#2C1810` |
| `wolf` | Wolf | Pointed upward (2×3) | Long snout | `#8899AA` | `#C0C8D0` |
| `frog` | Frog | No ears, bulging eyes | Wide mouth, green | `#5A9E32` | `#7BC74D` |
| `husky` | Husky | Pointed (2×3) | Face mask pattern | `#7A8899` | `#FFFFFF` |
| `bichon` | Bichon | Fluffy round (3×3) | Fluffy round face | `#FAFAFA` | `#F0E8E0` |
| `corgi` | Welsh Corgi | Large pointed (3×3) | Tan/white split face | `#D4A040` | `#FAFAFA` |

#### Animal Color Palettes (each has base, shadow, accent)

```
Bear:    base=#8B6544  shadow=#6B4E30  accent=#D4A574  nose=#2C1810
Rabbit:  base=#F5E6D3  shadow=#E0CDB8  accent=#FFB6C1  nose=#FF9A9E
Tiger:   base=#E8A040  shadow=#C08030  accent=#2C1810  nose=#2C1810
Wolf:    base=#8899AA  shadow=#667788  accent=#C0C8D0  nose=#2C1810
Frog:    base=#5A9E32  shadow=#488028  accent=#7BC74D  belly=#C8E8A0
Husky:   base=#7A8899  shadow=#5A6877  accent=#FFFFFF  nose=#2C1810
Bichon:  base=#FAFAFA  shadow=#E8E0D8  accent=#F0E8E0  nose=#2C1810
Corgi:   base=#D4A040  shadow=#B08030  accent=#FAFAFA  nose=#2C1810
```

---

## 4. Sprite Data Format

### 4.1 Main Character Sprite (16×16)

Sprites are defined as `SpriteData = (string | null)[][]`:
- Each element is a hex color string or `null` (transparent)
- Row 0 = top of sprite, Row 15 = bottom
- Scale: 1px = 1 canvas pixel at base resolution

### 4.2 Ghost/Visitor Sprite (6×12)

Simplified version for visitor ghosts drawn via Canvas API directly:
- Head: 6×6px (rows 0-5)
- Body: 6×6px (rows 6-11)
- Rendered at `globalAlpha` based on visit recency

### 4.3 Mini Portrait (6×8)

Ultra-compact for sidebar icons:
- Head: 6×4px (rows 0-3)
- Body: 6×4px (rows 4-7)
- Must be recognizable at this tiny size

### 4.4 Naming Convention

```
CHARACTER_SPRITES[typeId] = SpriteData     // 16×16 full sprite
GHOST_SPRITES[typeId] = draw function      // 6×12 canvas API
MINI_PORTRAITS[typeId] = draw function     // 6×8 canvas API
```

---

## 5. Environment Style

### 5.1 Ground

- **Grass**: Bright green (#7BC74D) base with dark (#5A9E32) pattern dots
- **Dirt/Farm**: Warm brown (#8B6914) with dark (#6B4E0A) texture
- **Path**: Sandy (#C4A97D) with shadow (#B8956E)
- **Decorations**: Small flowers (3px tall), stones (3×2px), grass tufts
- All decorations use **soft, rounded shapes** — no sharp edges

### 5.2 Sky

- **Gradients**: Smooth 2-3 stop gradients per time of day
- **Clouds**: Soft pixel clouds using size-based width formula
- **Sun/Moon**: Simple 4-6px shapes, sun has animated rays
- **Stars**: 1px white dots with blink animation (night only)

### 5.3 Fence

- **Posts**: 2×5px brown, placed at corners and midpoints
- **Rails**: 1px brown lines connecting posts
- **Style**: Rustic, slightly irregular (pixel art charm)

### 5.4 Crops

- **Grid**: 4×4, each cell 32×32px
- **Sprites**: 16×16px centered in cell
- **Growth**: 4 stages (seed → sprout → growing → harvestable)
- **Style**: Round, cute versions of real vegetables

---

## 6. Color Palette Rules

### 6.1 Skin Tones (for human characters)

| ID | Base | Shadow | Description |
|----|------|--------|-------------|
| `light` | `#FFD5B8` | `#E8B796` | Default light (current) |
| `medium` | `#D4A574` | `#B8886A` | Medium tan |
| `dark` | `#8B6544` | `#6B4E30` | Dark |
| `pale` | `#FFF0E0` | `#F0D8C0` | Very pale |

### 6.2 Clothes Colors (body, shared across all types)

| ID | Base | Shadow | Description |
|----|------|--------|-------------|
| `blue` | `#6C9BD2` | `#4A7FB5` | Default blue |
| `red` | `#E57373` | `#C05050` | Red |
| `green` | `#81C784` | `#5A9E5A` | Green |
| `purple` | `#BA68C8` | `#9040A0` | Purple |
| `orange` | `#FFB74D` | `#E09530` | Orange |
| `pink` | `#F06292` | `#D04070` | Pink |
| `teal` | `#4DB6AC` | `#309088` | Teal |
| `yellow` | `#FFD54F` | `#E0B830` | Yellow |

### 6.3 Shadow Rules

- Character shadow: `rgba(0,0,0,0.2)` — always 8px wide, row 15
- Object shadows: Darker version of base color, offset 1px down
- Never use pure black for shadows on organic objects

---

## 7. Animation Guidelines

### 7.1 Character Bounce

- **Idle**: Slow bounce, period 40 frames (24 during boost). Shift -1px every half-period
- **Walk**: Fast bob, period 6 frames. -1px every 3 frames
- **Direction**: Face movement direction. Mirror via `ctx.scale(-1, 1)`

### 7.2 Ghost Characters

- **Wander speed**: 0.35 px/frame (slower than main character's 0.8)
- **Opacity**: Fades from 0.6 to 0.15 over 24 hours
- **Tracked ghost**: Opacity boosted to min(opacity*1.5, 0.9)

### 7.3 Speech Bubble

- **Background**: Cream `#FFFBE6`
- **Border**: Brown `#5B4A3A`, 1px, stepped corners (pixel art rounded rect)
- **Tail**: 3px triangle pointing down to character head
- **Text**: `4px monospace`, brown `#3E2723`, max 28 chars

---

## 8. Character Customization Data Model

### 8.1 Type Definition

```typescript
interface CharacterAppearance {
  type: 'human' | 'bear' | 'rabbit' | 'tiger' | 'wolf' | 'frog' | 'husky' | 'bichon' | 'corgi';
  // Human-only options
  hairStyle?: 'short' | 'long' | 'curly' | 'ponytail' | 'bun' | 'spiky' | 'bob' | 'buzz';
  hairColor?: string; // hex color ID from hair palette
  skinTone?: 'light' | 'medium' | 'dark' | 'pale';
  eyeStyle?: 'dot' | 'round' | 'line' | 'star' | 'closed';
  accessory?: 'none' | 'glasses' | 'sunglasses' | 'eyepatch' | 'bandaid';
  // Shared options
  clothesColor?: string; // hex color ID from clothes palette
}
```

### 8.2 Storage

- **Local**: `state.json` → `user.character` field
- **Server**: `PublicProfile.character` field (synced via `/api/farm/sync`)
- **Default**: `{ type: 'human', hairStyle: 'short', hairColor: 'brown', skinTone: 'light', eyeStyle: 'dot', accessory: 'none', clothesColor: 'blue' }`

### 8.3 Rendering Priority

When rendering a character:
1. Look up `character.type` → select head sprite/draw function
2. Apply `clothesColor` to shared body template
3. For humans: apply `hairStyle`, `hairColor`, `skinTone`, `eyeStyle`, `accessory`
4. For animals: use type-specific color palette, ignore human-only fields

---

## 9. Implementation Checklist

When adding a new character type:

- [ ] Define 16×16 full sprite data (or procedural draw function)
- [ ] Define 6×12 ghost sprite draw function
- [ ] Define 6×8 mini portrait draw function
- [ ] Add color palette entry
- [ ] Add to `CharacterAppearance.type` union
- [ ] Add to character selection UI (web + VSCode)
- [ ] Test at all zoom levels (1x, 1.5x, 2.5x)
- [ ] Test in both 1st person and 3rd person modes
- [ ] Ensure ghost version is distinguishable at low opacity

When modifying environment art:

- [ ] Keep within 256×192 base canvas
- [ ] Use only palette colors (no arbitrary hex)
- [ ] Test across all 4 time-of-day variants
- [ ] Ensure boost mode visual compatibility
- [ ] Test with 1-16 crops and 0-8 ghosts simultaneously

---

## 10. VSCode Extension Parity

The VSCode extension renders characters via inline Canvas API (not sprite data).
When changing character visuals:

1. Update `packages/web/canvas/sprites.ts` (web sprite data)
2. Update `packages/web/canvas/renderer.ts` (web ghost/portrait draw functions)
3. Update `packages/vscode/src/extension.ts` (inline draw functions: `drawCharPixels`, `drawGhostPixels`, `drawMiniPortraitVS`)
4. All three renderers MUST produce visually identical results

---

## 11. File Reference

| File | What to modify |
|------|---------------|
| `shared/src/types.ts` | `CharacterAppearance` type, add to `LocalState.user` |
| `packages/web/canvas/sprites.ts` | Character sprite data, `drawSprite()` |
| `packages/web/canvas/palette.ts` | New color entries for character parts |
| `packages/web/canvas/renderer.ts` | `drawCharacter()`, `drawGhostSprite()`, `drawMiniPortrait()` |
| `packages/web/components/FarmCanvas.tsx` | Pass character data to renderer |
| `packages/web/components/FarmView.tsx` | Character customization UI |
| `packages/vscode/src/extension.ts` | `drawCharPixels()`, `drawGhostPixels()`, `drawMiniPortraitVS()` |
| `packages/web/lib/api.ts` | Sync character appearance |
| `packages/web/app/api/farm/sync/route.ts` | Store character in Redis profile |
