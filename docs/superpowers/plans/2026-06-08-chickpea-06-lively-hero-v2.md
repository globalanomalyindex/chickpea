# Chickpea Plan 6 — Lively Hero v2 (ranked measurement field + auto-layout mode)

> Enhancement to the alive hero. At rest the composition stays **pixel-faithful to the Figma and renders without JS** — everything here is cursor/drag enhancement layered on top. Pure model is TDD'd; interaction feel is orchestrator-verified + tuned live.

**Goal:** Make the hero feel like a living design canvas. (1) Every *word* (not just the title) reacts. (2) As the cursor moves, a small **ranked set of measurements** (~3–4, calm not chaotic) renders at once — the gap you're nearest plus fading secondaries. (3) The **negative-space margins** come alive: hovering in a margin near a word slides it and draws an arrow from the page border to the word. (4) Arrows **track the cursor** and snap **fast** (kill the 260ms clunk). (5) A toggleable **auto-layout drag mode**: drag any word/group around the negative space with live Figma-style border + neighbor arrows and alignment/snap guides; dragged items **stay + snap** (hover-nudges always spring back); a **reset** restores the Figma composition.

**Current state (what exists):** `src/hero/Hero.tsx` renders a 758×1024 scaled stage; title is per-letter spans (`data-letter="title-N"`), other blocks render one span per line (`data-line="<block>-<lineIdx>"`); blocks wrap in `data-block` divs. `src/hero/seams.ts` (Box/Seam, buildSeams, nearestSeam, separationOffset) + `src/hero/MeasureLayer.tsx` (one nearest-seam within RADIUS=90, CSS 260ms separation, single `DimensionArrow`, GridBloom). `DimensionArrow` (h/v) in `src/components/`. Layout constants in `src/hero/heroLayout.ts` (ARTBOARD, TEXT_BLOCKS = grid-generator/title/portfolio/skills, GLYPHS = arrows). Stage→artboard coord mapping: `getBoundingClientRect` relative to the stage root rect, divided by `stage.scale`.

**Tech:** React, TS, Motion (springs), SVG, Vitest. Keep `prefers-reduced-motion` support (already subscribed in MeasureLayer).

---

## Stage 1 — `src/hero/measurements.ts` (pure model + tests)

A unified, ranked measurement model. **Pure, no React.** Reuses the `Box` idea but adds element `kind` and margin measurements.

```ts
export interface Box { id: string; kind: 'letter' | 'word' | 'block'; x: number; y: number; w: number; h: number }
export interface Artboard { w: number; h: number }
export interface Pt { x: number; y: number }

export type Measurement =
  | { id: string; type: 'gap'; axis: 'v' | 'h'; aId: string; bId: string; gap: number;
      // span endpoints (artboard px) of the gap along the separating axis:
      span: { x1: number; y1: number; x2: number; y2: number };
      // the line on which the two elements sit (for cursor projection):
      lo: number; hi: number }            // shared perpendicular extent (y-range for axis 'v', x-range for 'h')
  | { id: string; type: 'margin'; side: 'left' | 'right' | 'top' | 'bottom'; elId: string; dist: number;
      span: { x1: number; y1: number; x2: number; y2: number };
      lo: number; hi: number }            // the element's extent along the border

export interface Selected { m: Measurement; strength: number } // strength 0..1 by cursor proximity
```

Functions:

- `buildGaps(boxes: Box[]): Measurement[]` — group boxes into rows (same kind, overlapping y, adjacent x → 'v' gaps between neighbors) and columns (overlapping x, adjacent y → 'h' gaps). Letters form one row; words within a line form a row; lines/blocks stacked form columns. Each gap stores the two element ids, the numeric gap, the span between the facing edges, and the shared perpendicular extent `[lo,hi]`.
- `buildMargins(boxes: Box[], art: Artboard): Measurement[]` — for each `kind:'word'|'block'` box, four margin measurements: left `dist=x`, right `dist=art.w-(x+w)`, top `dist=y`, bottom `dist=art.h-(y+h)`. `span` runs border→element edge; `[lo,hi]` is the element's extent along that border.
- `buildMeasurements(boxes, art): Measurement[]` = gaps ++ margins.
- `cursorRelevance(m, p): { strength: number; track: Pt }` — distance from `p` to the measurement, and the cursor-tracked draw point (project `p` onto the measurement's perpendicular extent: for a 'v' gap, `track.y = clamp(p.y, lo, hi)`, `track.x = gap center x`; for 'left' margin, `track.y = clamp(p.y, lo, hi)`, the arrow spans x∈[0, elementLeft]; etc.). A **margin is only relevant when the cursor is actually in that margin band** (e.g. left: `p.x < elementLeft` and `p.y ∈ [lo,hi]`). Strength = `max(0, 1 - d / radius)`.
- `selectMeasurements(ms, p, { maxCount, radius }): Selected[]` — compute relevance, drop strength 0, sort desc, take top `maxCount`. The top one is the "primary".
- `elementOffsets(selected, delta): Map<string,{dx:number;dy:number}>` — net transient nudge per element id (summed across selected, scaled by strength):
  - gap 'v' at strength s → aId `dx -= delta*s/2`, bId `dx += delta*s/2` (push apart along x). 'h' → along y.
  - margin at strength s → push the element AWAY from its border (open the margin): left → `dx += delta*s`; right → `dx -= delta*s`; top → `dy += delta*s`; bottom → `dy -= delta*s`.

**Tests (`measurements.test.ts`):** gap detection for a row of letters and a column of lines (count, axis, gap value, span); margin distances correct for a known box+artboard; `cursorRelevance` returns strength 1 at the measurement and 0 outside radius, and a margin is irrelevant when the cursor isn't in its band; `selectMeasurements` returns ≤maxCount sorted by strength; `elementOffsets` pushes gap pairs apart and nudges margin elements off their border, scaled by strength; deterministic.

> Keep `seams.ts` for now (its tests pass); `measurements.ts` is the new engine MeasureLayer uses. If fully superseded, delete `seams.ts` + its test and update imports — but only if nothing else references it.

---

## Stage 2 — UI integration (Hero word-wrap + MeasureLayer v2 + DragLayer + mode toggle)

One coherent change set (these files are tightly coupled; one agent owns them): `src/hero/Hero.tsx`, `src/hero/MeasureLayer.tsx`, `src/hero/DragLayer.tsx` (new), `src/components/DimensionArrow.tsx` (extend), `src/hero/heroLayout.ts` (only if a helper is needed).

### 2.1 Word-wrapping in `Hero.tsx`
- Title stays per-letter (`data-letter="title-N"`).
- For every other block line, split the line into words and render each as `<span data-word="<block>-<lineIdx>-<wordIdx>">`, preserving spaces between them (render a normal space text node so the layout is identical to today). Keep `data-block` wrappers. Keep `willChange:'transform'`, `display:'inline-block'` on words.
- Net visual at rest must be IDENTICAL to today (same kerning, positions) — verify against the Figma.
- Provide a hero **mode** state (`'measure' | 'layout'`) and a small, restrained toggle (a mono corner control near the existing CornerNav, e.g. `measure · layout`, or a keyboard shortcut `L`; make it discoverable but quiet). Pass `mode` + a persisted `placement` map (id→{dx,dy}) + setters to the layers.

### 2.2 `MeasureLayer.tsx` v2 (mode === 'measure')
- Measure ALL reactive boxes in artboard coords: title letters (`kind:'letter'`), words (`data-word`, `kind:'word'`), and blocks (`data-block`, `kind:'block'`), via getBoundingClientRect-relative-to-stage / scale. Subtract any applied offset so seams build from the resting composition.
- On pointermove (rAF-throttled): `selectMeasurements(buildMeasurements(boxes, ARTBOARD), cursorArtboardPt, { maxCount: 4, radius: 150 })`.
- Render one `DimensionArrow` per selected measurement, **positioned at its cursor-tracked draw point** (so it follows the cursor along the gap / margin), with **opacity = strength** (primary full, secondaries fade) and the measured px value. Margin arrows span border→element.
- Apply `elementOffsets(selected, DELTA)` to the matching word/letter/block DOM elements as transforms. **Hover always springs back**: when an element isn't in the current offsets, transform → identity.
- **Snappy feel:** replace the 260ms CSS transition with a fast spring. Either Motion (`useSpring`/`animate`, stiffness ~600, damping ~26, mass ~0.6) or, if simpler, a fast transition `transform 120ms cubic-bezier(.2,.9,.25,1)`. The motion must read as immediate + lively, never laggy. The arrow position should track without visible lag (update each rAF; transition the arrow's left/top with the same fast curve or none).
- Keep the GridBloom in the empty upper field (it can stay, lightly).
- Respect `prefers-reduced-motion`: arrows still show; skip the element nudges.

### 2.3 `DragLayer.tsx` (mode === 'layout')
- Suppress measure-hover; instead, every word/block is grabbable. On pointerdown on an element, begin a drag (track pointer delta in artboard px, accounting for stage.scale).
- While dragging, render live annotations in cream measure-ink:
  - **Four border arrows** from the dragged element's edges to the artboard borders, with live distances.
  - **Neighbor-gap arrows** to the 1–2 nearest other elements (reuse `buildGaps`-style measuring against the dragged element's live box).
  - **Alignment guides + snap:** when the dragged element's left/center/right or top/middle/bottom comes within ~6px of another element's matching edge/center (or a key artboard line: margins x=23/x=735, centerlines), draw a full-length guide line through the alignment and SNAP the position to it. A small node/tick marks the alignment.
- On release: commit the (snapped) position into the `placement` map (id→{dx,dy} from the element's composition origin); the element **stays**. Re-entering measure mode keeps placements (transforms persist) until reset.
- A **reset** control (in the mode toggle area) clears `placement` → everything springs back to the exact Figma composition.
- Apply `placement` transforms to elements in BOTH modes (so moved items stay put while you also measure). Drag uses the same fast spring on release/snap.

### 2.4 `DimensionArrow.tsx` extension
- Add an optional `opacity` prop (for fading secondaries) and ensure labels stay legible (cream, mono). Optionally add a lightweight `GuideLine` component (a thin full-span cream line + optional end ticks) for the drag alignment guides — or implement guides inline in DragLayer. Keep the arrow API backward-compatible.

---

## Constraints / acceptance

- **Figma-faithful at rest** (no cursor, no placements): byte-for-byte the current composition; renders without JS.
- **Calm, not chaotic:** ≤4 simultaneous arrows in measure mode; secondaries clearly subordinate (opacity).
- **Snappy:** no motion slower than ~150ms-equivalent; springy/immediate, not the old 260ms ease. Arrows visibly track the cursor.
- **All words react;** margins usable (border→word arrows when hovering the negative space near a word).
- **Drag mode:** real drag, live border+neighbor arrows, alignment/snap guides, stays+snaps, reset works; hover-nudges still spring back.
- **Reduced motion** respected; **keyboard**: mode toggle + reset focusable.
- `npm run typecheck && npm test && npm run build` all green; existing 76 tests still pass (update only seams/measurements tests as legitimately needed).

## Build order
1. `measurements.ts` + tests (Stage 1).
2. UI integration (Stage 2) against the model.
3. Orchestrator: central typecheck/test/build, then live feel-tuning in the preview (the part that can't be delegated): tune DELTA, radius, maxCount, spring constants, arrow tracking, margin nudges, and the drag snap threshold until it feels alive and calm.
