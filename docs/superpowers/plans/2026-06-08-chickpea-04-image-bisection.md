# Chickpea Plan 4 — Image Bisection → Seeded Variations

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. Pure cores (k-means, dyadic, cursor-axis detector, anchor-snap) are TDD'd with Vitest; the bisection UI + studio integration are orchestrator-verified in the live preview.

**Goal:** Let the user **upload an image, bisect it with cuts** (the cursor-entry-direction gesture), and have Chickpea extract the image's palette and turn the human cuts into **infinite mathematically-correct grid variations** — each cut snapped to the nearest ratio-correct position, the rest generated. The thesis made literal: *human intent in, math-perfect variations out.*

**Architecture:** Pure, tested cores — `palette/kmeans.ts` (image → dominant colors), `palette/dyadic-layout.ts` (square-packed swatch), `bisection/cursor-axis-detector.ts` (entry-direction → axis), `grid/anchor.ts` (cuts → snapped, valid, varying grids). Browser glue — `io/image-io.ts` (file → downsized pixels), `studio/ImageBisection.tsx` (upload + cut gesture). The studio gains an **image mode**: image palette + anchored grid → the existing `buildComposition` + `CompositionSvg` + export, unchanged.

**Tech Stack:** React, TS, Canvas 2D, Vitest. Builds on Plans 1–3 (reuses `Grid`, `generate`, `buildComposition`, `CompositionSvg`, `SkeletonReveal`, export).

**Spec:** `docs/superpowers/specs/2026-06-08-chickpea-design.md` (§2 bisection, §1 reuse).

---

## File Structure

```
src/palette/kmeans.ts            # image pixels -> ColorWeight[] — PURE
src/palette/kmeans.test.ts
src/palette/dyadic-layout.ts     # square-packed swatch — PURE
src/palette/dyadic-layout.test.ts
src/bisection/cursor-axis-detector.ts   # entry-direction -> axis — PURE
src/bisection/cursor-axis-detector.test.ts
src/grid/anchor.ts               # cuts -> snapped valid varying Grid — PURE
src/grid/anchor.test.ts
src/io/image-io.ts               # file -> downsized [r,g,b][] (browser)
src/studio/ImageBisection.tsx    # upload + cut-placement gesture
src/studio/Studio.tsx            # add image mode (palette + anchors)
```

---

## Task 1: k-means palette (pure + tested)

**Files:** `src/palette/kmeans.ts`, `src/palette/kmeans.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { kmeans } from './kmeans'

// three tight clusters around red, green, blue
function cluster(base: [number, number, number], n: number, jitter = 5): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++) out.push([base[0] + (i % jitter), base[1], base[2]] as [number, number, number])
  return out
}

describe('kmeans', () => {
  const pixels = [...cluster([240, 10, 10], 30), ...cluster([10, 230, 10], 20), ...cluster([10, 10, 220], 10)]

  it('returns k clusters sorted by descending weight, deterministic', () => {
    const a = kmeans(pixels, 3, 1)
    const b = kmeans(pixels, 3, 1)
    expect(a.length).toBe(3)
    expect(a).toEqual(b)
    for (let i = 1; i < a.length; i++) expect(a[i].weight).toBeLessThanOrEqual(a[i - 1].weight)
  })

  it('finds centroids near the true cluster centers', () => {
    const c = kmeans(pixels, 3, 1)
    const reds = c.find((x) => x.rgb[0] > 150)!
    expect(reds.rgb[0]).toBeGreaterThan(150)
    expect(reds.weight).toBe(30) // the red cluster is largest
  })
})
```

- [ ] **Step 2: Run → fail. Step 3: Implement**

```ts
import { mulberry32 } from '../grid/prng'

export interface ColorWeight {
  rgb: [number, number, number]
  weight: number
}

const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

export function kmeans(pixels: [number, number, number][], k: number, seed: number, iters = 12): ColorWeight[] {
  if (pixels.length === 0) return []
  const rng = mulberry32(seed)
  // seed centroids from k distinct random pixels
  const centroids: number[][] = []
  const used = new Set<number>()
  while (centroids.length < k && used.size < pixels.length) {
    const idx = Math.floor(rng() * pixels.length)
    if (used.has(idx)) continue
    used.add(idx)
    centroids.push([...pixels[idx]])
  }
  const assign = new Array(pixels.length).fill(0)
  for (let it = 0; it < iters; it++) {
    // assign
    for (let p = 0; p < pixels.length; p++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const dd = d2(pixels[p], centroids[c])
        if (dd < bestD) {
          bestD = dd
          best = c
        }
      }
      assign[p] = best
    }
    // update
    const sums = centroids.map(() => [0, 0, 0, 0])
    for (let p = 0; p < pixels.length; p++) {
      const a = assign[p]
      sums[a][0] += pixels[p][0]
      sums[a][1] += pixels[p][1]
      sums[a][2] += pixels[p][2]
      sums[a][3]++
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0) centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]]
    }
  }
  const counts = centroids.map(() => 0)
  for (const a of assign) counts[a]++
  return centroids
    .map((c, i) => ({ rgb: [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as [number, number, number], weight: counts[i] }))
    .sort((a, b) => b.weight - a.weight)
}
```

- [ ] **Step 4: Run → pass. Step 5: Commit** `feat(palette): k-means image palette`

---

## Task 2: Dyadic swatch layout (pure + tested)

Per old spec §5: pack weighted colors into a unit square, all sub-squares, dominant top-left, perfect tiling.

**Files:** `src/palette/dyadic-layout.ts`, `src/palette/dyadic-layout.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { dyadicLayout } from './dyadic-layout'

describe('dyadicLayout', () => {
  const colors = [
    { rgb: [200, 0, 0] as [number, number, number], weight: 64 },
    { rgb: [0, 200, 0] as [number, number, number], weight: 16 },
    { rgb: [0, 0, 200] as [number, number, number], weight: 4 },
  ]
  it('tiles the unit square with square cells, dominant at top-left', () => {
    const sw = dyadicLayout(colors)
    const area = sw.reduce((s, c) => s + c.w * c.h, 0)
    expect(area).toBeCloseTo(1, 5)
    expect(sw.every((c) => Math.abs(c.w - c.h) < 1e-9)).toBe(true)
    const first = sw.find((c) => c.x === 0 && c.y === 0)!
    expect(first.rgb).toEqual([200, 0, 0])
  })
  it('is deterministic', () => {
    expect(dyadicLayout(colors)).toEqual(dyadicLayout(colors))
  })
})
```

- [ ] **Step 2–4:** Implement `dyadicLayout(colors): {rgb;x;y;w;h}[]` using the §5 procedure: normalize weights → quantize to powers of 1/4 (1, 1/4, 1/16, 1/64) → sort desc → walk a `freeSquares` list seeded with the unit square, placing each color in the top-left quadrant and pushing the other three quadrants; fill leftover squares with the lowest-weight color. Make it deterministic. **Step 5: Commit** `feat(palette): dyadic square-packed swatch`

---

## Task 3: Cursor-entry-direction detector (pure + tested)

Per old spec §3: entering through top/bottom ⇒ vertical-cut mode; left/right ⇒ horizontal-cut mode; corner tie resolved by the larger crossing displacement.

**Files:** `src/bisection/cursor-axis-detector.ts`, `src/bisection/cursor-axis-detector.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { entryEdge, axisForEdge } from './cursor-axis-detector'

const rect = { w: 100, h: 100 }

describe('entryEdge', () => {
  it('detects the edge crossed when moving inside', () => {
    expect(entryEdge({ x: 50, y: -5 }, { x: 50, y: 5 }, rect)).toBe('top')
    expect(entryEdge({ x: 50, y: 105 }, { x: 50, y: 95 }, rect)).toBe('bottom')
    expect(entryEdge({ x: -5, y: 50 }, { x: 5, y: 50 }, rect)).toBe('left')
    expect(entryEdge({ x: 105, y: 50 }, { x: 95, y: 50 }, rect)).toBe('right')
  })
  it('returns null when both points are inside (no crossing)', () => {
    expect(entryEdge({ x: 40, y: 40 }, { x: 60, y: 60 }, rect)).toBeNull()
  })
  it('breaks a corner tie by the larger crossing displacement', () => {
    // crosses both top and left; vertical displacement larger -> top
    expect(entryEdge({ x: -2, y: -10 }, { x: 5, y: 5 }, rect)).toBe('top')
  })
})

describe('axisForEdge', () => {
  it('top/bottom -> v, left/right -> h', () => {
    expect(axisForEdge('top')).toBe('v')
    expect(axisForEdge('bottom')).toBe('v')
    expect(axisForEdge('left')).toBe('h')
    expect(axisForEdge('right')).toBe('h')
  })
})
```

- [ ] **Step 2–4:** Implement `entryEdge(prev, curr, rect): 'top'|'bottom'|'left'|'right'|null` (curr must be inside, prev outside on the chosen edge; corner tie → larger crossing displacement) and `axisForEdge`. **Step 5: Commit** `feat(bisection): cursor entry-direction detector`

---

## Task 4: Anchor → snapped valid varying grid (pure + tested)

**Files:** `src/grid/anchor.ts`, `src/grid/anchor.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { snapToRatio, buildAnchoredGrid, RATIO_POSITIONS } from './anchor'
import { checkBounds, checkTiling } from './invariants'

describe('snapToRatio', () => {
  it('snaps a rough cut to the nearest ratio-correct position', () => {
    expect(snapToRatio(0.51)).toBeCloseTo(0.5, 6)
    expect(snapToRatio(0.6)).toBeCloseTo(0.618, 6) // golden section nearest
    expect(RATIO_POSITIONS).toContain(0.5)
  })
})

describe('buildAnchoredGrid', () => {
  const cuts = [
    { axis: 'v' as const, pos: 0.52 },
    { axis: 'h' as const, pos: 0.4 },
  ]
  it('honors snapped cuts and tiles the unit square', () => {
    const g = buildAnchoredGrid(cuts, 1)
    // a vertical guide near 0.5 and a horizontal near 0.382 exist
    expect(g.guides.some((gd) => gd.axis === 'v' && Math.abs(gd.pos - 0.5) < 1e-6)).toBe(true)
    expect(checkBounds(g.modules)).toBe(true)
    expect(checkTiling(g.modules).covered).toBe(true)
  })
  it('different seeds vary the in-region subdivisions but keep the anchors', () => {
    const a = buildAnchoredGrid(cuts, 1)
    const b = buildAnchoredGrid(cuts, 2)
    expect(a.modules).not.toEqual(b.modules)
    // both keep the snapped vertical anchor at 0.5
    for (const g of [a, b]) expect(g.guides.some((gd) => gd.axis === 'v' && Math.abs(gd.pos - 0.5) < 1e-6)).toBe(true)
  })
})
```

- [ ] **Step 2–4:** Implement:
  - `RATIO_POSITIONS = [0.5, 1/3, 2/3, 0.382, 0.618, 0.25, 0.75, 0.236, 0.764, 0.2, 0.8]`
  - `snapToRatio(pos)` → nearest of `RATIO_POSITIONS`.
  - `buildAnchoredGrid(cuts, seed)`: snap each cut; form the base lattice of cells from the unique snapped v/h positions; then **seed-vary** by optionally splitting a subset of the resulting cells at a ratio position (reuse the recursive split helper) — preserving the anchor guides and a valid gap-free tiling. Return a `Grid` (`generator: 'recursive'`, `ratios` from the snapped positions, `meta.anchored: true`).
  - Invariants must hold for all seeds. **Step 5: Commit** `feat(grid): anchored grid from human bisections`

---

## Task 5: Image IO (browser)

**Files:** `src/io/image-io.ts`

- [ ] **Step 1:** Implement `loadImagePixels(file: File, maxDim = 96): Promise<{ pixels: [number,number,number][]; width: number; height: number; dataUrl: string }>` — draw the image to an offscreen canvas downsized so the longest side ≤ `maxDim`, read `getImageData`, collect `[r,g,b]` (skip fully transparent), and also return a full-res `dataUrl` for display. Keep it dependency-free. **Step 2: Commit** `feat(io): image load + downsized pixel sampling`

---

## Task 6: ImageBisection UI

**Files:** `src/studio/ImageBisection.tsx`

Contract: `<ImageBisection onCommit={(cuts, palette, dataUrl) => void} />`. Drag/drop or click to upload (reuse `loadImagePixels`); show the image; run `kmeans` (k=6) → `dyadicLayout` for a small swatch display. Over the image, the **cursor-entry-direction gesture**: track the pointer entering the image rect, use `entryEdge`/`axisForEdge` to pick vertical vs horizontal mode, show a live guide tracking the pointer, **click to drop a cut**; placed cuts render as cream hairlines with a draggable handle + a mono `V 0.52`/`H 0.40` readout; drag a cut off the image to delete. A **"use these cuts →"** button calls `onCommit(cuts, palette, dataUrl)`.

- [ ] **Step 1:** Implement to the contract, in the established design language (cream measure-ink, mono readouts, hairlines). Touch fallback: two pill toggles `V`/`H` if entry-direction can't be detected.
- [ ] **Step 2: Orchestrator visual check** — upload a fixture image; confirm the entry-direction gesture flips axis correctly, cuts drop/drag/delete, the palette swatch reads from the image.
- [ ] **Step 3: Commit** `feat(studio): image bisection gesture`

---

## Task 7: Studio image mode

**Files:** `src/studio/Studio.tsx`

- [ ] **Step 1:** Add a mode toggle: **From scratch** (existing) vs **From image**. In image mode: render `ImageBisection`; on commit, store `{ cuts, palette, dataUrl }`. Build the composition from `buildAnchoredGrid(cuts, seed)` + the image palette (converted to `PaletteColor` via the existing shape — wrap `ColorWeight` into `{hex,rgb,weight,...}` using `rgbToHex`). **Generate/Iterate** now re-seed the anchored variations (cuts stay fixed; the math varies). Reveal + export work unchanged. A "re-bisect" affordance returns to the upload/cut step.
- [ ] **Step 2: Orchestrator check** — upload → bisect → commit → see an image-palette composition honoring the cuts; Generate produces correct variations keeping the anchors; export works.
- [ ] **Step 3: Typecheck + tests + build green. Commit** `feat(studio): image bisection mode`

---

## Self-Review

**Spec coverage (§2):** upload ✓ (Task 5); cursor-entry-direction bisection ✓ (Tasks 3, 6); k-means palette + dyadic swatch ✓ (Tasks 1, 2); anchors snapped to ratio-correct positions + infinite correct variations ✓ (Task 4); integration ✓ (Task 7). "Human intent in, math-perfect variations out" is realized end-to-end.

**Placeholder scan:** pure cores (kmeans, dyadic, cursor-axis-detector, anchor) ship complete code + tests. UI (ImageBisection, Studio image mode) ships contracts; visual/interaction correctness is orchestrator-verified.

**Type consistency:** `ColorWeight` (kmeans) → dyadic + Studio (wrapped to `PaletteColor`). `entryEdge`/`axisForEdge` (detector) → ImageBisection. `snapToRatio`/`buildAnchoredGrid` (anchor) → Studio; `buildAnchoredGrid` returns the shared `Grid`, so `buildComposition`/`CompositionSvg`/export consume it unchanged. `loadImagePixels` shape → ImageBisection + Studio.

**Deferred:** image transform/mesh-warp (out of scope per spec §12); per-region palette (whole-image palette only in v1).
