# Chickpea Plan 3 — Studio Core (generate compositions from scratch + export)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. Pure modules (palette, typography-fit, composition) are TDD'd with Vitest; the studio UI + export are verified by the orchestrator in the live preview. Steps use checkbox syntax.

**Goal:** A working studio at `/studio` where the user generates **mathematically-correct grid compositions from scratch** — pick a generator family, generate/iterate seeds, watch the grid fill with a seeded nature-palette (optional squeeze-fit type), toggle the **skeleton reveal** to see the math, and **export PNG/SVG**. Shareable via the seed in the URL. A subtle link carries the user from the hero into the studio.

**Architecture:** Pure cores stay React-free and tested: `palette/generate.ts` (seeded harmonious palette), `type/typography-fit.ts` (squeeze-fill scale math with an injected text-measurer), `studio/composition.ts` (Grid + palette + seed → a `Composition` of colored/typed modules). The studio renders the `Composition` as **SVG**; `SkeletonReveal` overlays guides/dimensions/ratios reusing `DimensionArrow`; export serializes the same SVG (and rasterizes for PNG).

**Tech Stack:** React, TS, Motion, SVG, Canvas 2D (PNG), Vitest. Builds on Plans 1–2.

**Spec:** `docs/superpowers/specs/2026-06-08-chickpea-design.md` (§1, §3 composition, §5 export). Image-seeded palettes + bisection are **Plan 4** (this plan uses seeded generated palettes).

---

## File Structure

```
src/palette/generate.ts        # seeded nature palette — PURE
src/palette/generate.test.ts
src/palette/hsl.ts             # hsl->rgb + hex helpers — PURE
src/palette/hsl.test.ts
src/type/typography-fit.ts     # squeeze-fill scale math — PURE
src/type/typography-fit.test.ts
src/studio/composition.ts      # Grid + palette -> Composition — PURE
src/studio/composition.test.ts
src/studio/CompositionSvg.tsx  # render a Composition as SVG (+ measured text fit)
src/studio/SkeletonReveal.tsx  # guides + dims + ratios overlay (reuses DimensionArrow)
src/studio/GeneratorControls.tsx
src/studio/Studio.tsx          # composes controls + canvas + URL sync
src/io/export-svg.ts           # Composition -> SVG string — PURE-ish
src/io/export-png.ts           # Composition -> PNG blob (Canvas)
src/app/routes/StudioRoute.tsx
src/app/App.tsx                # add /studio
src/hero/Hero.tsx              # add subtle "enter studio" link
```

---

## Task 1: HSL/RGB helpers (pure + tested)

**Files:** `src/palette/hsl.ts`, `src/palette/hsl.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { hslToRgb, rgbToHex } from './hsl'

describe('hslToRgb', () => {
  it('maps known colors', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0])
    expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0])
    expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0])
    expect(hslToRgb(0, 0, 1)).toEqual([255, 255, 255])
  })
})

describe('rgbToHex', () => {
  it('formats lowercase 6-digit hex', () => {
    expect(rgbToHex([255, 0, 0])).toBe('#ff0000')
    expect(rgbToHex([78, 106, 122])).toBe('#4e6a7a')
  })
})
```

- [ ] **Step 2: Run → fail. Step 3: Implement**

```ts
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
```

- [ ] **Step 4: Run → pass. Step 5: Commit** `feat(palette): hsl/rgb color helpers`

---

## Task 2: Seeded nature palette (pure + tested)

Generate a harmonious, **muted nature** palette from a seed: a base hue chosen from botanical/earth anchors, then a seed-selected scheme (analogous / complementary / triad) with constrained saturation + a lightness spread, weights descending.

**Files:** `src/palette/generate.ts`, `src/palette/generate.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { generatePalette } from './generate'

describe('generatePalette', () => {
  it('returns exactly count colors as hex with descending weights', () => {
    const p = generatePalette(42, 5)
    expect(p.length).toBe(5)
    expect(p[0].hex).toMatch(/^#[0-9a-f]{6}$/)
    for (let i = 1; i < p.length; i++) expect(p[i].weight).toBeLessThanOrEqual(p[i - 1].weight)
  })

  it('is deterministic for a seed', () => {
    expect(generatePalette(7, 6)).toEqual(generatePalette(7, 6))
  })

  it('different seeds diverge', () => {
    expect(generatePalette(1, 5)[0].hex).not.toBe(generatePalette(2, 5)[0].hex)
  })

  it('stays in the muted nature saturation band', () => {
    for (const c of generatePalette(123, 8)) {
      expect(c.s).toBeGreaterThanOrEqual(0.12)
      expect(c.s).toBeLessThanOrEqual(0.62)
    }
  })
})
```

- [ ] **Step 2: Run → fail. Step 3: Implement**

```ts
import { mulberry32, pick, type Rng } from '../grid/prng'
import { hslToRgb, rgbToHex } from './hsl'

export interface PaletteColor {
  hex: string
  rgb: [number, number, number]
  h: number
  s: number
  l: number
  weight: number
}

// botanical / earth / mineral hue anchors (degrees)
const NATURE_HUES = [28, 42, 86, 122, 158, 196, 18, 348]
const SCHEMES: number[][] = [
  [0, 18, -18, 36, -36, 54], // analogous
  [0, 180, 12, 168, -12, 192], // complementary pairs
  [0, 120, 240, 24, 144, 264], // triad
]

export function generatePalette(seed: number, count: number): PaletteColor[] {
  const rng: Rng = mulberry32(seed)
  const baseH = pick(rng, NATURE_HUES) + (rng() * 16 - 8)
  const scheme = pick(rng, SCHEMES)
  const out: PaletteColor[] = []
  for (let i = 0; i < count; i++) {
    const h = baseH + scheme[i % scheme.length] + (rng() * 10 - 5)
    const s = 0.18 + rng() * 0.4 // 0.18..0.58 muted
    const l = 0.32 + (i / Math.max(1, count - 1)) * 0.5 + (rng() * 0.06 - 0.03) // spread dark->light
    const rgb = hslToRgb(h, s, Math.max(0.08, Math.min(0.92, l)))
    out.push({ hex: rgbToHex(rgb), rgb, h: ((h % 360) + 360) % 360, s, l, weight: count - i })
  }
  return out
}
```

- [ ] **Step 4: Run → pass. Step 5: Commit** `feat(palette): seeded muted nature palette`

---

## Task 3: Squeeze-fill typography (pure + tested)

Per old spec §6. `fitText` computes per-line and global scaleX/scaleY so a string fills a rect, with an **injected** width-measurer so it is pure and testable.

**Files:** `src/type/typography-fit.ts`, `src/type/typography-fit.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { fitText } from './typography-fit'

// mock measurer: width = chars * 10 at the reference size
const measure = (line: string) => line.length * 10

describe('fitText', () => {
  it('fills width: widest line scales to the inner width', () => {
    const f = fitText({ text: 'AB', width: 200, height: 100, measure, refSize: 100, lineHeight: 1, padding: 0 })
    // 'AB' intrinsic width 20 -> globalScaleX = 200/20 = 10
    expect(f.lines[0].scaleX).toBeCloseTo(10, 5)
  })

  it('fills height across N lines', () => {
    const f = fitText({ text: 'A\nBB', width: 200, height: 200, measure, refSize: 100, lineHeight: 1, padding: 0 })
    // 2 lines, refSize 100, lineHeight 1 -> stack height 200 -> globalScaleY = 200/200 = 1
    expect(f.lines[0].scaleY).toBeCloseTo(1, 5)
    // per-line normalize: line 'A'(10) widened to match widest 'BB'(20) before global
    expect(f.lines[0].scaleX / f.lines[1].scaleX).toBeCloseTo(2, 5)
  })

  it('respects padding (fraction of the rect)', () => {
    const f = fitText({ text: 'A', width: 200, height: 100, measure, refSize: 100, lineHeight: 1, padding: 0.1 })
    // inner width = 200*(1-0.2)=160; 'A'=10 -> 16
    expect(f.lines[0].scaleX).toBeCloseTo(16, 5)
  })
})
```

- [ ] **Step 2: Run → fail. Step 3: Implement**

```ts
export interface LineFit { text: string; scaleX: number; scaleY: number }
export interface TextFit { lines: LineFit[]; innerW: number; innerH: number }

export interface FitParams {
  text: string
  width: number
  height: number
  measure: (line: string) => number // intrinsic width at refSize
  refSize: number
  lineHeight: number
  padding: number // fraction 0..0.5 of each axis (both sides)
}

export function fitText(p: FitParams): TextFit {
  const lines = p.text.split('\n')
  const innerW = p.width * (1 - 2 * p.padding)
  const innerH = p.height * (1 - 2 * p.padding)
  const widths = lines.map((l) => Math.max(1, p.measure(l)))
  const maxW = Math.max(...widths)
  const globalScaleX = innerW / maxW
  const globalScaleY = innerH / (lines.length * p.refSize * p.lineHeight)
  return {
    innerW,
    innerH,
    lines: lines.map((text, i) => ({
      text,
      scaleX: globalScaleX * (maxW / widths[i]),
      scaleY: globalScaleY,
    })),
  }
}
```

- [ ] **Step 4: Run → pass. Step 5: Commit** `feat(type): squeeze-fill typography math`

---

## Task 4: Composition model (pure + tested)

Assign palette colors to modules (dominant → largest module), choose a background, and seed-select a sparse subset of modules to carry a word from a small nature word-bank.

**Files:** `src/studio/composition.ts`, `src/studio/composition.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildComposition } from './composition'
import { generate } from '../grid/generators'
import { generatePalette } from '../palette/generate'

describe('buildComposition', () => {
  it('colors every module and is deterministic', () => {
    const grid = generate('recursive', 10)
    const pal = generatePalette(10, 6)
    const a = buildComposition(grid, pal, { seed: 10 })
    const b = buildComposition(grid, pal, { seed: 10 })
    expect(a.modules.length).toBe(grid.modules.length)
    expect(a.modules.every((m) => /^#[0-9a-f]{6}$/.test(m.color))).toBe(true)
    expect(a).toEqual(b)
  })

  it('gives the largest module the dominant (first) palette color', () => {
    const grid = generate('nature', 3)
    const pal = generatePalette(3, 5)
    const comp = buildComposition(grid, pal, { seed: 3 })
    const largest = comp.modules.reduce((p, c) => (c.module.w * c.module.h > p.module.w * p.module.h ? c : p))
    expect(largest.color).toBe(pal[0].hex)
  })

  it('places text on at most the requested fraction of modules', () => {
    const grid = generate('modular', 5)
    const pal = generatePalette(5, 6)
    const comp = buildComposition(grid, pal, { seed: 5, textChance: 0.25 })
    const withText = comp.modules.filter((m) => m.text).length
    expect(withText).toBeLessThanOrEqual(Math.ceil(comp.modules.length * 0.6))
  })
})
```

- [ ] **Step 2: Run → fail. Step 3: Implement**

```ts
import { mulberry32, pick, type Rng } from '../grid/prng'
import type { Grid, Module } from '../grid/types'
import type { PaletteColor } from '../palette/generate'

export interface CompModule {
  module: Module
  color: string
  text: string | null
}
export interface Composition {
  background: string
  modules: CompModule[]
}

const WORDS = ['grid', 'phi', 'root', 'seed', 'leaf', 'ratio', 'field', 'form', 'order', 'grow']

export function buildComposition(
  grid: Grid,
  palette: PaletteColor[],
  opts: { seed: number; textChance?: number },
): Composition {
  const rng: Rng = mulberry32(opts.seed ^ 0x51ed)
  const textChance = opts.textChance ?? 0
  // order modules by area desc so dominant color lands on the largest
  const order = grid.modules
    .map((module, i) => ({ module, i }))
    .sort((a, b) => b.module.w * b.module.h - a.module.w * a.module.h)
  const colored: CompModule[] = new Array(grid.modules.length)
  order.forEach((entry, rank) => {
    const color = palette[Math.min(rank, palette.length - 1)].hex
    const text = rng() < textChance ? pick(rng, WORDS) : null
    colored[entry.i] = { module: entry.module, color, text }
  })
  const background = palette[palette.length - 1].hex
  return { background, modules: colored }
}
```

- [ ] **Step 4: Run → pass. Step 5: Commit** `feat(studio): composition model (color + sparse type)`

---

## Task 5: CompositionSvg renderer

**Files:** `src/studio/CompositionSvg.tsx`

Contract: `<CompositionSvg composition grid size aspect />` renders an SVG `viewBox="0 0 1 1"` (or aspect-correct) with one `<rect>` per module (filled `color`), and for modules with `text`, a squeeze-fit `<text>` using `fitText` with a **real measurer** (an offscreen canvas `measureText` at `refSize`, font Mafinest). Text fill = a high-contrast palette color (cream or the darkest/lightest swatch depending on the module color's luminance). Background `<rect>` fills the canvas with `composition.background`.

- [ ] **Step 1: Implement** the component. Use a module-level memoized offscreen `CanvasRenderingContext2D` for `measureText`. Compute luminance to pick legible text color (`#f4f0e8` on dark modules, `#2a2e31` on light). Apply the per-line transform as `transform="translate(...) scale(scaleX, scaleY)"` on each `<text>`, positioned within the module rect with padding. Keep strokes off (flat color blocks).
- [ ] **Step 2: Orchestrator visual check** in `/studio` (after Task 8). Confirm modules fill with palette colors, text squeeze-fills cleanly, nothing overflows.
- [ ] **Step 3: Commit** `feat(studio): CompositionSvg renderer`

---

## Task 6: SkeletonReveal overlay

**Files:** `src/studio/SkeletonReveal.tsx`

Contract: `<SkeletonReveal grid size show />` overlays, in the cream measure-ink language: guide hairlines for `grid.guides`, a faint outline per module, the module's pixel dims on hover, and the grid's `ratios` labels (e.g. `φ`, `module 1.43`) placed near the relevant axis — reusing `DimensionArrow` for at least one worked dimension (e.g. the dominant module's width). Toggleable; animates opacity in/out. It is the studio echo of the hero's Measure layer — same visual vocabulary.

- [ ] **Step 1: Implement.** Keep it legible on the composition (cream ink, subtle shadow/halo if needed for contrast over light modules). Guides at 0.0015 viewBox stroke; module outlines hairline; ratio labels in mono.
- [ ] **Step 2: Orchestrator visual check.** Toggle reveal on/off over a composition; confirm the math reads clearly and truthfully (ratios match the grid).
- [ ] **Step 3: Commit** `feat(studio): skeleton reveal overlay`

---

## Task 7: Export (SVG + PNG)

**Files:** `src/io/export-svg.ts`, `src/io/export-png.ts`

- [ ] **Step 1: `export-svg.ts`** — pure function `compositionToSvg(composition, grid, { width, height, includeGrid }): string` producing a standalone `<svg>` string: background rect, module rects, squeeze-fit `<text>` (matrix transforms), optional grid hairlines, `<defs>` `@font-face` embedding Mafinest as base64 (fetch the otf, base64 once, cache). Include `<title>Chickpea</title>` + `<desc>Made with Chickpea · seed N</desc>`. Add a small unit test asserting the string contains the background color, a `<rect>` per module, and the seed in `<desc>`.
- [ ] **Step 2: `export-png.ts`** — `compositionToPngBlob(composition, grid, { width, height }): Promise<Blob>` drawing to an offscreen `<canvas>` at 2× then downsampling: background fill, per-module `fillRect`, per-module squeeze-fit text via `ctx.save/translate/scale/fillText/restore`. Returns a PNG blob.
- [ ] **Step 3: Filenames** `chickpea-{YYYYMMDD-HHMMSS}.{svg|png}` via a helper that takes a Date (injected, for testability).
- [ ] **Step 4: Commit** `feat(io): SVG + PNG composition export`

---

## Task 8: GeneratorControls + Studio + route

**Files:** `src/studio/GeneratorControls.tsx`, `src/studio/Studio.tsx`, `src/app/routes/StudioRoute.tsx`, `src/app/App.tsx`

- [ ] **Step 1: `Studio.tsx`** holds state: `generator` (kind), `seed`, `revealOn`, `textOn`. Derives `grid = generate(generator, seed)`, `palette = generatePalette(seed, 6)`, `composition = buildComposition(grid, palette, { seed, textChance: textOn ? 0.3 : 0 })`. Syncs `(generator, seed)` to the URL query via `useSearchParams` (reuse `encode/decodeDescriptor` from `grid/serialize.ts`); on mount, read the descriptor from the URL. Layout: a large centered composition canvas on slate, a left/bottom control rail in the Mafinest/mono design language.
- [ ] **Step 2: `GeneratorControls.tsx`** — family selector (recursive/modular/nature), **Generate** (new random seed), **Iterate** (seed±1 / small param nudge), seed readout + editable, **Reveal math** toggle, **Type** toggle, **Export PNG/SVG** buttons. Mono readouts (`modules: N`, `seed: N`, `φ` etc.). Match the hero's restraint.
- [ ] **Step 3: `StudioRoute.tsx`** = `<Studio/>`; add `<Route path="/studio" .../>` in `App.tsx`.
- [ ] **Step 4: Typecheck + tests + build green.** Orchestrator verifies the full loop in preview: generate → iterate → reveal → type → export.
- [ ] **Step 5: Commit** `feat(studio): generator controls + studio route`

---

## Task 9: Hero → studio entry

**Files:** `src/hero/Hero.tsx`

- [ ] **Step 1:** Make the composition's `→` arrow (or a small, tasteful "open the studio →" affordance that respects the Figma restraint) a link to `/studio`. Keep the hero visually faithful — the link should be discoverable but not disrupt the composition (e.g., the `→` glyph becomes an anchor; on hover it gets a subtle cream underline + a measure tick). Confirm keyboard focusable.
- [ ] **Step 2: Orchestrator visual check** — hero still matches Figma at rest; the entry works.
- [ ] **Step 3: Commit** `feat(hero): enter-studio link`

---

## Self-Review

**Spec coverage:** §1 generators reused via registry ✓; §3 composition (palette fills + squeeze-fit type) → Tasks 4,5 ✓; skeleton reveal → Task 6 ✓; §5 export PNG/SVG → Task 7 ✓; seed-in-URL sharing → Task 8 ✓; generate/iterate from scratch → Task 8 ✓. Image-seeded palette + bisection are **Plan 4** (explicitly out of this increment).

**Placeholder scan:** pure modules (hsl, generate, typography-fit, composition, export-svg) ship complete code + tests. UI components (CompositionSvg, SkeletonReveal, controls, Studio) ship contracts + concrete behavior; visual correctness is orchestrator-verified — appropriate for rendering/layout work, not missing logic.

**Type consistency:** `PaletteColor` (generate) consumed by composition + CompositionSvg. `Composition`/`CompModule` (composition) consumed by CompositionSvg + export. `TextFit`/`fitText` (typography-fit) consumed by CompositionSvg + export-png. `generate`/`encode/decodeDescriptor` reused from Plan 1. `DimensionArrow` reused from Plan 2.

**Deferred:** image upload, bisection gesture, k-means + dyadic swatch, anchored variations → Plan 4. Per-module focus/edit, font picker, undo → later/none (YAGNI for the portfolio).
