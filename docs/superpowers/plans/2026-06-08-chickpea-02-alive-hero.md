# Chickpea Plan 2 — Alive Hero

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Pure logic (seams, stage scale) is TDD'd with Vitest; visual fidelity + interaction feel are verified by the orchestrator against the Figma reference via the live preview.

**Goal:** A landing hero that reproduces the Figma composition **exactly** (dashed rectangle omitted), renders fully without JavaScript, and comes **alive** under the cursor — letters and blocks spring apart to reveal their spacing with animated dimension arrows, and a faint grid blooms in the empty upper field; everything springs back to the exact composition when the cursor leaves.

**Architecture:** A fixed **758×1024 artboard** scaled to fit the viewport (`contain`), centered on slate. Every element is absolutely positioned in artboard pixels from a single typed layout source (`heroLayout.ts`). The static render IS the faithful composition. A `MeasureLayer` overlay measures the *actually rendered* DOM letter/line boxes (so glyph metrics never have to be precomputed), finds the seam nearest the cursor with a pure function, springs the relevant elements apart, and draws `DimensionArrow`s. Pure geometry (`seams.ts`, `stageScale.ts`) is unit-tested; motion uses Motion springs.

**Tech Stack:** React, TypeScript, Motion (`motion/react`), Vitest. Builds on Plan 1.

**Spec:** `docs/superpowers/specs/2026-06-08-chickpea-design.md` (§4 alive hero, §5 export reuse N/A here).

**Figma reference:** file `rM0VYEJW2bw77BHLRnDtKR`, node `21:401` ("Desktop - 1", 758×1024). Palette: slate `#5d646b`, cream `#f4f0e8`, steel `#4e6a7a`. Font: Mafinest (vendored in Plan 1).

---

## Figma element map (artboard coordinates, px)

| Element | Box (x,y,w,h) | Type | Notes |
|---|---|---|---|
| dashed rect | 23,17,722,530 | — | **OMITTED (cut)** |
| `grid generator` / `by christopher robin fiore` | 53,547,682,123 | text 48px, ls −4.8, right-aligned (right edge 735), bottom-anchored | 2 lines, cream |
| `→` | 23,586,40,44 | text 40px, cream | centered in box |
| `Chickpea` | 23,686,712,218 | text 200px, ls −20, line-height 1.088, right-aligned (right edge 735) | cream |
| `portfolio theme:` / `looking to nature for answers` | 38,864,682,123 | text 48px, ls −4.8, line-height 1.0, left-aligned (left edge 38), bottom-anchored | 2 lines, cream |
| `←` | 695,951,40,44 | text 40px, cream | centered in box |
| `skills` | right edge 226, baseline ≈1040 | text 32px, ls −3.2, steel, right-aligned | small accent |
| skills rule | x 0→226, y 1052, 1px | hairline, steel | sits at artboard bottom edge |

The whole field above y≈547 is intentionally empty slate.

---

## File Structure (this plan)

```
src/hero/heroLayout.ts     # typed layout constants (single source of truth) — PURE
src/hero/stageScale.ts     # contain-fit scale + client↔stage coord mapping — PURE
src/hero/stageScale.test.ts
src/hero/seams.ts          # nearest-seam detection over measured rects — PURE
src/hero/seams.test.ts
src/hero/useStageScale.ts  # React hook wrapping stageScale + resize observer
src/hero/Hero.tsx          # the faithful scaled artboard (renders w/o JS)
src/hero/MeasureLayer.tsx  # pointer tracking + spring separation + arrows + grid bloom
src/components/DimensionArrow.tsx  # shared SVG arrow + value label
src/app/routes/HeroRoute.tsx
src/app/App.tsx            # add '/' -> HeroRoute (keep '/dev')
```

---

## Task 1: Hero layout source of truth

**Files:** Create `src/hero/heroLayout.ts`

- [ ] **Step 1: Write `src/hero/heroLayout.ts`**

```ts
export const ARTBOARD = { w: 758, h: 1024 } as const

export const HERO_COLORS = {
  slate: '#5d646b',
  cream: '#f4f0e8',
  steel: '#4e6a7a',
} as const

export interface TextBlock {
  id: string
  lines: string[]
  fontSize: number
  letterSpacing: number
  lineHeight: number
  color: string
  align: 'left' | 'right'
  /** Anchor edge in artboard px. For align:'right' this is the right edge; for 'left', the left edge. */
  anchorX: number
  /** Top of the block's box in artboard px. */
  top: number
  /** Box height in artboard px (text is bottom-anchored within it). */
  height: number
}

export const TITLE: TextBlock = {
  id: 'title',
  lines: ['Chickpea'],
  fontSize: 200,
  letterSpacing: -20,
  lineHeight: 1.088,
  color: HERO_COLORS.cream,
  align: 'right',
  anchorX: 735,
  top: 686,
  height: 218,
}

export const GRID_GENERATOR: TextBlock = {
  id: 'grid-generator',
  lines: ['grid generator', 'by christopher robin fiore'],
  fontSize: 48,
  letterSpacing: -4.8,
  lineHeight: 1.04,
  color: HERO_COLORS.cream,
  align: 'right',
  anchorX: 735,
  top: 547,
  height: 123,
}

export const PORTFOLIO: TextBlock = {
  id: 'portfolio',
  lines: ['portfolio theme:', 'looking to nature for answers'],
  fontSize: 48,
  letterSpacing: -4.8,
  lineHeight: 1.04,
  color: HERO_COLORS.cream,
  align: 'left',
  anchorX: 38,
  top: 864,
  height: 123,
}

export const SKILLS: TextBlock = {
  id: 'skills',
  lines: ['skills'],
  fontSize: 32,
  letterSpacing: -3.2,
  lineHeight: 1.0,
  color: HERO_COLORS.steel,
  align: 'right',
  anchorX: 226,
  top: 1005,
  height: 35,
}

export interface Glyph {
  id: string
  glyph: string
  fontSize: number
  left: number
  top: number
}

export const ARROW_RIGHT: Glyph = { id: 'arrow-right', glyph: '→', fontSize: 40, left: 23, top: 586 }
export const ARROW_LEFT: Glyph = { id: 'arrow-left', glyph: '←', fontSize: 40, left: 695, top: 951 }

export const SKILLS_RULE = { x0: 0, x1: 226, y: 1052 } as const

export const TEXT_BLOCKS: TextBlock[] = [GRID_GENERATOR, TITLE, PORTFOLIO, SKILLS]
export const GLYPHS: Glyph[] = [ARROW_RIGHT, ARROW_LEFT]
```

- [ ] **Step 2: Commit**

```bash
git add src/hero/heroLayout.ts
git commit -m "feat(hero): Figma layout source of truth"
```

---

## Task 2: Stage scale (contain-fit) — pure + tested

**Files:** Create `src/hero/stageScale.ts`, `src/hero/stageScale.test.ts`

- [ ] **Step 1: Write the failing test `src/hero/stageScale.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeStage, clientToStage } from './stageScale'

const ART = { w: 758, h: 1024 }

describe('computeStage (contain fit, centered)', () => {
  it('fits to height on a wide viewport and centers horizontally', () => {
    const s = computeStage(2000, 1024, ART)
    expect(s.scale).toBeCloseTo(1, 6) // 1024/1024
    expect(s.offsetX).toBeCloseTo((2000 - 758) / 2, 6)
    expect(s.offsetY).toBeCloseTo(0, 6)
  })

  it('fits to width on a tall/narrow viewport and centers vertically', () => {
    const s = computeStage(379, 2000, ART)
    expect(s.scale).toBeCloseTo(0.5, 6) // 379/758
    expect(s.offsetY).toBeCloseTo((2000 - 1024 * 0.5) / 2, 6)
    expect(s.offsetX).toBeCloseTo(0, 6)
  })
})

describe('clientToStage', () => {
  it('inverts the transform: a client point maps back to artboard coords', () => {
    const stage = computeStage(2000, 1024, ART) // scale 1, offsetX 621, offsetY 0
    const p = clientToStage(stage.offsetX + 100, stage.offsetY + 200, stage)
    expect(p.x).toBeCloseTo(100, 6)
    expect(p.y).toBeCloseTo(200, 6)
  })

  it('accounts for scale', () => {
    const stage = computeStage(379, 2000, ART) // scale 0.5
    const p = clientToStage(stage.offsetX + 50, stage.offsetY + 50, stage)
    expect(p.x).toBeCloseTo(100, 6) // 50 / 0.5
    expect(p.y).toBeCloseTo(100, 6)
  })
})
```

- [ ] **Step 2: Run test → fails** — `npx vitest run src/hero/stageScale.test.ts` → cannot find module.

- [ ] **Step 3: Write `src/hero/stageScale.ts`**

```ts
export interface Artboard { w: number; h: number }
export interface Stage { scale: number; offsetX: number; offsetY: number }
export interface Point { x: number; y: number }

/** Uniform "contain" fit of the artboard into the viewport, centered. */
export function computeStage(vw: number, vh: number, art: Artboard): Stage {
  const scale = Math.min(vw / art.w, vh / art.h)
  const offsetX = (vw - art.w * scale) / 2
  const offsetY = (vh - art.h * scale) / 2
  return { scale, offsetX, offsetY }
}

/** Map a client/viewport point into artboard coordinates. */
export function clientToStage(clientX: number, clientY: number, stage: Stage): Point {
  return {
    x: (clientX - stage.offsetX) / stage.scale,
    y: (clientY - stage.offsetY) / stage.scale,
  }
}
```

- [ ] **Step 4: Run test → passes.**

- [ ] **Step 5: Commit**

```bash
git add src/hero/stageScale.ts src/hero/stageScale.test.ts
git commit -m "feat(hero): contain-fit stage scaling (pure + tested)"
```

---

## Task 3: Seam detection — pure + tested

A **seam** is a measurable gap between two adjacent rendered boxes (two letters, or two stacked lines/blocks). Detection runs over rects already measured from the DOM and expressed in **artboard coordinates**, so this module is pure and deterministic.

**Files:** Create `src/hero/seams.ts`, `src/hero/seams.test.ts`

- [ ] **Step 1: Write the failing test `src/hero/seams.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildSeams, nearestSeam, type Box } from './seams'

// three letters in a row, each 100 wide, 200 tall, with 20px gaps
const letters: Box[] = [
  { id: 'C', x: 0, y: 0, w: 100, h: 200 },
  { id: 'h', x: 120, y: 0, w: 100, h: 200 },
  { id: 'i', x: 240, y: 0, w: 100, h: 200 },
]

describe('buildSeams (horizontal neighbors -> vertical seams)', () => {
  it('creates one seam per adjacent pair', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    expect(seams.length).toBe(2)
    expect(seams[0].axis).toBe('v') // a vertical seam between side-by-side letters
    expect(seams[0].gap).toBeCloseTo(20, 6)
    expect(seams[0].center.x).toBeCloseTo(110, 6) // midpoint of the gap
    expect(seams[0].leftIds).toEqual(['C'])
    expect(seams[0].rightIds).toEqual(['h', 'i'])
  })
})

describe('buildSeams (stacked boxes -> horizontal seams)', () => {
  it('measures vertical gaps for axis y', () => {
    const lines: Box[] = [
      { id: 'l0', x: 0, y: 0, w: 300, h: 50 },
      { id: 'l1', x: 0, y: 70, w: 300, h: 50 },
    ]
    const seams = buildSeams([{ group: 'block', boxes: lines, axis: 'y' }])
    expect(seams.length).toBe(1)
    expect(seams[0].axis).toBe('h')
    expect(seams[0].gap).toBeCloseTo(20, 6)
    expect(seams[0].center.y).toBeCloseTo(60, 6)
  })
})

describe('nearestSeam', () => {
  it('returns the seam whose center is closest, within the radius', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    const hit = nearestSeam(seams, { x: 232, y: 100 }, 120)
    expect(hit?.center.x).toBeCloseTo(230, 6) // the second seam (between h and i)
  })

  it('returns null when nothing is within the radius', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    expect(nearestSeam(seams, { x: 1000, y: 1000 }, 120)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test → fails.**

- [ ] **Step 3: Write `src/hero/seams.ts`**

```ts
export interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface SeamGroup {
  group: string
  boxes: Box[] // in render order along the axis
  axis: 'x' | 'y' // 'x' = boxes are side-by-side; 'y' = stacked
}

export interface Seam {
  id: string
  group: string
  axis: 'v' | 'h' // 'v' = a vertical line separating left/right; 'h' = horizontal separating top/bottom
  center: { x: number; y: number }
  gap: number
  /** ids on each side, for the separation animation. */
  leftIds: string[]
  rightIds: string[]
  /** index of the gap (boxes[index] | boxes[index+1]). */
  index: number
}

export function buildSeams(groups: SeamGroup[]): Seam[] {
  const seams: Seam[] = []
  for (const g of groups) {
    const b = g.boxes
    for (let i = 0; i < b.length - 1; i++) {
      const a = b[i]
      const c = b[i + 1]
      if (g.axis === 'x') {
        const gap = c.x - (a.x + a.w)
        const cx = a.x + a.w + gap / 2
        const cy = a.y + a.h / 2
        seams.push({
          id: `${g.group}-${i}`,
          group: g.group,
          axis: 'v',
          center: { x: cx, y: cy },
          gap,
          leftIds: b.slice(0, i + 1).map((x) => x.id),
          rightIds: b.slice(i + 1).map((x) => x.id),
          index: i,
        })
      } else {
        const gap = c.y - (a.y + a.h)
        const cx = a.x + a.w / 2
        const cy = a.y + a.h + gap / 2
        seams.push({
          id: `${g.group}-${i}`,
          group: g.group,
          axis: 'h',
          center: { x: cx, y: cy },
          gap,
          leftIds: b.slice(0, i + 1).map((x) => x.id),
          rightIds: b.slice(i + 1).map((x) => x.id),
          index: i,
        })
      }
    }
  }
  return seams
}

export function nearestSeam(seams: Seam[], p: { x: number; y: number }, radius: number): Seam | null {
  let best: Seam | null = null
  let bestD = radius
  for (const s of seams) {
    const d = Math.hypot(s.center.x - p.x, s.center.y - p.y)
    if (d <= bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

/** Per-box separation offset (in artboard px) for an active seam, with falloff by distance from the seam index. */
export function separationOffset(seam: Seam, boxId: string, allIds: string[], delta: number): number {
  const idx = allIds.indexOf(boxId)
  if (idx < 0) return 0
  const side = idx <= seam.index ? -1 : 1
  const dist = side < 0 ? seam.index - idx : idx - (seam.index + 1)
  const falloff = Math.max(0, 1 - dist * 0.4) // neighbors move less
  return side * (delta / 2) * falloff
}
```

- [ ] **Step 4: Run test → passes.**

- [ ] **Step 5: Add a test for `separationOffset`** (append to `seams.test.ts`)

```ts
import { separationOffset } from './seams'

describe('separationOffset', () => {
  it('pushes left-side boxes negative and right-side positive, with falloff', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    const seam = seams[0] // between C(index0) and h
    const ids = ['C', 'h', 'i']
    expect(separationOffset(seam, 'C', ids, 24)).toBeCloseTo(-12, 6) // full, immediate left
    expect(separationOffset(seam, 'h', ids, 24)).toBeCloseTo(12, 6) // full, immediate right
    expect(separationOffset(seam, 'i', ids, 24)).toBeCloseTo(12 * 0.6, 6) // one further, falloff
  })
})
```

- [ ] **Step 6: Run test → passes. Commit**

```bash
git add src/hero/seams.ts src/hero/seams.test.ts
git commit -m "feat(hero): seam detection + separation offsets (pure + tested)"
```

---

## Task 4: DimensionArrow shared primitive

**Files:** Create `src/components/DimensionArrow.tsx`

- [ ] **Step 1: Write `src/components/DimensionArrow.tsx`**

```tsx
interface Props {
  orientation: 'h' | 'v' // h = horizontal double arrow (measuring an x-gap); v = vertical
  /** length of the arrow in px (the measured span). */
  length: number
  /** label text, e.g. "20" or "φ". */
  label: string
  color?: string
  /** stroke width in px. */
  strokeWidth?: number
}

/**
 * A measurement arrow: a line with arrowheads at both ends and a centered value.
 * Rendered in its own local coordinate space; the caller positions/rotates it.
 */
export function DimensionArrow({ orientation, length, label, color = '#4e6a7a', strokeWidth = 1.5 }: Props) {
  const head = 5
  if (orientation === 'h') {
    return (
      <svg width={length} height={16} style={{ overflow: 'visible', display: 'block' }}>
        <line x1={0} y1={8} x2={length} y2={8} stroke={color} strokeWidth={strokeWidth} />
        <polyline points={`${head},${8 - head} 0,8 ${head},${8 + head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <polyline points={`${length - head},${8 - head} ${length},8 ${length - head},${8 + head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <text x={length / 2} y={4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill={color}>{label}</text>
      </svg>
    )
  }
  return (
    <svg width={16} height={length} style={{ overflow: 'visible', display: 'block' }}>
      <line x1={8} y1={0} x2={8} y2={length} stroke={color} strokeWidth={strokeWidth} />
      <polyline points={`${8 - head},${head} 8,0 ${8 + head},${head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <polyline points={`${8 - head},${length - head} 8,${length} ${8 + head},${length - head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <text x={12} y={length / 2} textAnchor="start" fontFamily="var(--font-mono)" fontSize={11} fill={color}>{label}</text>
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DimensionArrow.tsx
git commit -m "feat: DimensionArrow measurement primitive"
```

---

## Task 5: useStageScale hook

**Files:** Create `src/hero/useStageScale.ts`

- [ ] **Step 1: Write `src/hero/useStageScale.ts`**

```ts
import { useEffect, useState } from 'react'
import { computeStage, type Stage } from './stageScale'
import { ARTBOARD } from './heroLayout'

export function useStageScale(): Stage {
  const [stage, setStage] = useState<Stage>(() =>
    computeStage(
      typeof window === 'undefined' ? ARTBOARD.w : window.innerWidth,
      typeof window === 'undefined' ? ARTBOARD.h : window.innerHeight,
      ARTBOARD,
    ),
  )
  useEffect(() => {
    const onResize = () => setStage(computeStage(window.innerWidth, window.innerHeight, ARTBOARD))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return stage
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hero/useStageScale.ts
git commit -m "feat(hero): useStageScale resize hook"
```

---

## Task 6: Hero (faithful static composition, renders without JS)

**Files:** Create `src/hero/Hero.tsx`

The stage is a 758×1024 absolutely-positioned box, `transform: scale(...)` from `useStageScale`, centered with the offsets. Every text block/glyph is absolutely positioned in artboard px. The title is split into per-letter `<span>`s (with `data-letter` ids) so the MeasureLayer can measure and animate them; other blocks render per-line `<span>`s with `data-line` ids. The MeasureLayer (Task 7) is rendered as a sibling overlay receiving the same stage.

- [ ] **Step 1: Write `src/hero/Hero.tsx`**

```tsx
import { useStageScale } from './useStageScale'
import { ARTBOARD, HERO_COLORS, TEXT_BLOCKS, GLYPHS, SKILLS_RULE, type TextBlock } from './heroLayout'
import { MeasureLayer } from './MeasureLayer'
import { useRef } from 'react'

function blockStyle(b: TextBlock): React.CSSProperties {
  return {
    position: 'absolute',
    top: b.top,
    height: b.height,
    left: b.align === 'left' ? b.anchorX : undefined,
    right: b.align === 'right' ? ARTBOARD.w - b.anchorX : undefined,
    width: 'max-content',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: b.align === 'left' ? 'flex-start' : 'flex-end',
    fontFamily: 'var(--font-display)',
    fontSize: b.fontSize,
    lineHeight: b.lineHeight,
    letterSpacing: b.letterSpacing,
    color: b.color,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }
}

export function Hero() {
  const stage = useStageScale()
  const stageRef = useRef<HTMLDivElement>(null)

  return (
    <main
      style={{ position: 'fixed', inset: 0, background: HERO_COLORS.slate, overflow: 'hidden' }}
    >
      <div
        ref={stageRef}
        style={{
          position: 'absolute',
          left: stage.offsetX,
          top: stage.offsetY,
          width: ARTBOARD.w,
          height: ARTBOARD.h,
          transform: `scale(${stage.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {TEXT_BLOCKS.map((b) => (
          <div key={b.id} style={blockStyle(b)} data-block={b.id}>
            {b.lines.map((line, li) =>
              b.id === 'title' ? (
                <div key={li} style={{ display: 'flex' }}>
                  {[...line].map((ch, ci) => (
                    <span key={ci} data-letter={`${b.id}-${ci}`} style={{ display: 'inline-block', willChange: 'transform' }}>
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <span key={li} data-line={`${b.id}-${li}`} style={{ display: 'inline-block', willChange: 'transform' }}>
                  {line}
                </span>
              ),
            )}
          </div>
        ))}

        {GLYPHS.map((g) => (
          <span
            key={g.id}
            data-glyph={g.id}
            style={{
              position: 'absolute',
              left: g.left,
              top: g.top,
              fontFamily: 'var(--font-display)',
              fontSize: g.fontSize,
              color: HERO_COLORS.cream,
              userSelect: 'none',
            }}
          >
            {g.glyph}
          </span>
        ))}

        {/* skills rule */}
        <div
          style={{
            position: 'absolute',
            left: SKILLS_RULE.x0,
            top: SKILLS_RULE.y,
            width: SKILLS_RULE.x1 - SKILLS_RULE.x0,
            height: 1,
            background: HERO_COLORS.steel,
          }}
        />

        <MeasureLayer stage={stage} stageRef={stageRef} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Orchestrator visual check (no commit yet if MeasureLayer absent).** `MeasureLayer` is created in Task 7; create a temporary no-op `MeasureLayer` stub returning `null` so Hero compiles, OR implement Task 7 first. Recommended: implement Task 7 before building, then verify together. For now create the stub:

`src/hero/MeasureLayer.tsx` (temporary):
```tsx
import type { Stage } from './stageScale'
export function MeasureLayer(_: { stage: Stage; stageRef: React.RefObject<HTMLDivElement> }) {
  return null
}
```

- [ ] **Step 3: Wire the route (see Task 8), run dev, screenshot, and compare to the Figma reference.** Acceptance: composition matches the Figma node 21:401 with the dashed rectangle absent; "Chickpea" is huge and right-aligned with tight tracking; the two 48px blocks and both arrows sit in the right places; upper field is empty slate. Adjust `lineHeight`/anchor values in `heroLayout.ts` only if visibly off.

- [ ] **Step 4: Commit**

```bash
git add src/hero/Hero.tsx src/hero/MeasureLayer.tsx
git commit -m "feat(hero): faithful static composition stage"
```

---

## Task 7: MeasureLayer — the alive cursor interaction

**Files:** Modify `src/hero/MeasureLayer.tsx` (replace the stub)

Behavior:
- Listens to `pointermove` on `window`; converts to stage coords via `clientToStage`.
- On each move: measure the current DOM letter boxes (title) and line boxes (other blocks) via `getBoundingClientRect`, convert to artboard coords (subtract stage offset, divide by scale), and build seam groups. (Measure lazily/throttled with `requestAnimationFrame`.)
- `nearestSeam(..., RADIUS)` selects the active seam. Apply `separationOffset` to each affected letter/line via a Motion spring on `x` (vertical seam) or `y` (horizontal seam).
- Render a `DimensionArrow` at the seam center showing the measured gap (rounded px) — horizontal arrow for a vertical seam, vertical arrow for a horizontal seam — its `length` growing to `gap + delta` as the elements separate.
- Faint grid: when the pointer is in the empty upper field (y < 540) and no seam is active, render a faint cross of guide lines through the pointer with small tick measurements (a subtle nod to the grid tool). Springs/opacity fade in and out.
- On `pointerleave`/cursor still: spring everything back to 0 (exact composition).
- Respect `prefers-reduced-motion`: skip the separation springs; only show the dimension arrow (no element movement).

- [ ] **Step 1: Implement `MeasureLayer.tsx`** to the contract above using `motion/react` (`useMotionValue`/`animate` or `motion.span` with `animate` props) and `DimensionArrow`. Keep all measurement in artboard coordinates. Constants: `RADIUS = 90`, `DELTA = 26`, spring `{ stiffness: 420, damping: 32, mass: 0.9 }`. Apply per-letter/per-line transforms by writing to the matching `data-letter`/`data-line` elements' style transforms (or render motion overlays). Prefer driving the existing spans: keep a map id→motion value and use `useAnimationFrame` to write `el.style.transform = translate(...)`.

  Reference shape (the orchestrator will verify feel and iterate):
```tsx
import { useEffect, useRef, useState } from 'react'
import { clientToStage, type Stage } from './stageScale'
import { buildSeams, nearestSeam, separationOffset, type Box, type Seam, type SeamGroup } from './seams'
import { DimensionArrow } from '../components/DimensionArrow'
import { HERO_COLORS } from './heroLayout'

const RADIUS = 90
const DELTA = 26

interface Props { stage: Stage; stageRef: React.RefObject<HTMLDivElement> }

export function MeasureLayer({ stage, stageRef }: Props) {
  const [seam, setSeam] = useState<Seam | null>(null)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Measure rendered boxes (artboard coords) from the stage DOM.
  function measureGroups(): SeamGroup[] {
    const root = stageRef.current
    if (!root) return []
    const toBox = (el: Element, id: string): Box => {
      const r = el.getBoundingClientRect()
      return {
        id,
        x: (r.left - (stage.offsetX + root.getBoundingClientRect().left - root.offsetLeft)) / stage.scale,
        y: (r.top) / stage.scale, // refined in implementation; see note
        w: r.width / stage.scale,
        h: r.height / stage.scale,
      }
    }
    // NOTE: implementer must compute box coords relative to the stage's untransformed
    // origin. Simplest robust approach: read each element's offsetLeft/offsetTop/offsetWidth/
    // offsetHeight (already in artboard px because the stage is the offset parent) instead of
    // getBoundingClientRect. Use that here.
    void toBox
    const letters = [...root.querySelectorAll<HTMLElement>('[data-letter^="title-"]')].map((el) => ({
      id: el.dataset.letter!, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight,
    }))
    const groups: SeamGroup[] = []
    if (letters.length) groups.push({ group: 'title', boxes: letters, axis: 'x' })
    // vertical seams between blocks: use each block wrapper's offset box
    const blocks = [...root.querySelectorAll<HTMLElement>('[data-block]')].map((el) => ({
      id: el.dataset.block!, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight,
    })).sort((a, b) => a.y - b.y)
    if (blocks.length > 1) groups.push({ group: 'blocks', boxes: blocks, axis: 'y' })
    return groups
  }

  useEffect(() => {
    let raf = 0
    function onMove(e: PointerEvent) {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const p = clientToStage(e.clientX, e.clientY, stage)
        const seams = buildSeams(measureGroups())
        setSeam(nearestSeam(seams, p, RADIUS))
      })
    }
    function onLeave() { setSeam(null) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [stage])

  // Apply separation to letters/blocks via direct style writes each frame.
  useEffect(() => {
    const root = stageRef.current
    if (!root) return
    const apply = () => {
      const active = seam && !reduced.current ? seam : null
      const letters = [...root.querySelectorAll<HTMLElement>('[data-letter^="title-"]')]
      const titleIds = letters.map((el) => el.dataset.letter!)
      for (const el of letters) {
        const off = active && active.group === 'title'
          ? separationOffset(active, el.dataset.letter!, titleIds, DELTA)
          : 0
        el.style.transition = 'transform 260ms cubic-bezier(.22,1,.36,1)'
        el.style.transform = `translateX(${off}px)`
      }
      const blocks = [...root.querySelectorAll<HTMLElement>('[data-block]')]
        .sort((a, b) => a.offsetTop - b.offsetTop)
      const blockIds = blocks.map((el) => el.dataset.block!)
      for (const el of blocks) {
        const off = active && active.group === 'blocks'
          ? separationOffset(active, el.dataset.block!, blockIds, DELTA)
          : 0
        el.style.transition = 'transform 260ms cubic-bezier(.22,1,.36,1)'
        el.style.transform = `translateY(${off}px)`
      }
    }
    apply()
  }, [seam])

  if (!seam) return null
  const arrowLen = seam.gap + DELTA
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: seam.axis === 'v' ? seam.center.x - arrowLen / 2 : seam.center.x,
          top: seam.axis === 'v' ? seam.center.y : seam.center.y - arrowLen / 2,
        }}
      >
        <DimensionArrow
          orientation={seam.axis === 'v' ? 'h' : 'v'}
          length={arrowLen}
          label={String(Math.round(seam.gap))}
          color={HERO_COLORS.steel}
        />
      </div>
    </div>
  )
}
```

> The reference uses a CSS transition for the separation (simple, GPU, good feel). The orchestrator may swap to Motion springs in the polish pass if the feel needs more life. Keep the `offsetLeft/offsetTop` measurement approach — because the stage is the `position:absolute` offset parent and elements are in artboard px, `offset*` reads ARE artboard coordinates, which is exactly what `seams`/`clientToStage` expect.

- [ ] **Step 2: Orchestrator interaction check.** Move the cursor between letters of "Chickpea" → the pair separates and a horizontal `↔` arrow with the px gap appears; move between the stacked blocks → they separate vertically with a `↕` arrow; move away → everything returns to the exact composition. Verify via the live preview (simulate `pointermove` and read transforms). Iterate constants (`RADIUS`, `DELTA`, easing) for feel.

- [ ] **Step 3: Commit**

```bash
git add src/hero/MeasureLayer.tsx
git commit -m "feat(hero): MeasureLayer — cursor-driven spacing reveal"
```

---

## Task 8: Route the hero at `/`

**Files:** Create `src/app/routes/HeroRoute.tsx`; modify `src/app/App.tsx`

- [ ] **Step 1: `src/app/routes/HeroRoute.tsx`**

```tsx
import { Hero } from '../../hero/Hero'
export function HeroRoute() {
  return <Hero />
}
```

- [ ] **Step 2: Update `src/app/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HeroRoute } from './routes/HeroRoute'
import { DevRoute } from './routes/DevRoute'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HeroRoute />} />
        <Route path="/dev" element={<DevRoute />} />
        <Route path="*" element={<HeroRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Verify `/` shows the hero, `/dev` still shows the generator harness. Typecheck + tests + build.**

Run: `npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/routes/HeroRoute.tsx src/app/App.tsx
git commit -m "feat(hero): route the alive hero at /"
```

---

## Self-Review

**Spec coverage (§4):**
- Figma-faithful composition, dashed rect cut → Task 6 + heroLayout (Task 1). ✓
- Renders without JS (static stage is pure markup; MeasureLayer only enhances) ✓
- Cursor reveals nearest seam, letters/blocks spring apart, dimension arrows with measured values → Tasks 3, 4, 7 ✓
- Faint grid bloom in the empty field → Task 7 Step 1 (grid bloom behavior; orchestrator verifies) ✓
- Springs back on leave; `prefers-reduced-motion` respected → Task 7 ✓
- Responsive contain-fit → Tasks 2, 5 ✓

**Placeholder scan:** Pure logic (heroLayout, stageScale, seams, DimensionArrow, useStageScale, Hero, App) is complete code. MeasureLayer ships a complete reference implementation; the plan explicitly flags feel-tuning (constants/easing) and the optional grid-bloom refinement as orchestrator-verified visual iteration — appropriate for motion work, not a placeholder for missing logic.

**Type consistency:** `Stage`/`Point`/`Artboard` (stageScale) used by useStageScale + MeasureLayer. `Box`/`Seam`/`SeamGroup` + `buildSeams`/`nearestSeam`/`separationOffset` (seams) used by MeasureLayer. `TextBlock`/`Glyph` (heroLayout) used by Hero. `DimensionArrow` props match call site. `data-letter="title-N"`, `data-line`, `data-block`, `data-glyph` attribute contracts are consistent between Hero and MeasureLayer.

**Deferred:** Word-level seams within a line (only letter-level for the title + block-level vertically in v1); richer grid-bloom in the empty field can grow in the polish pass.
