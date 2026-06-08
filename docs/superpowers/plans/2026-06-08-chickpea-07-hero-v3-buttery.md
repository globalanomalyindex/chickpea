# Chickpea Plan 7 — Hero v3 (buttery-smooth, unified, collision-aware)

> Animation craft per **emil-design-eng**: only `transform`/`opacity`, off the main React render path, instant response to input, springs only where decorative. At rest the hero stays **pixel-faithful to Figma and renders without JS**.

**Goal:** Make the alive hero feel *expensive*. Fix the lag (it's React re-rendering + `getBoundingClientRect` every pointer frame). Kill stale-arrow-on-fast-move. **Unify measure + layout into one mode** (hover measures, drag moves — no toggle). Add **collision avoidance** (numbers never overlap, arrows never cross words, nudged words never overlap — with a small annotation when an overlap is auto-corrected). Add **whisper-subtle engine grids** that bloom + morph in the negative space on interaction. Keep the at-rest composition exact (it already matches Figma's −10% tracking — verified; do not change the static render).

**Current state:** `Hero.tsx` (mode toggle + word-wrapped spans `data-word`, title letters `data-letter`, blocks `data-block`), `MeasureLayer.tsx` (React-state-per-frame measure — THE LAG), `DragLayer.tsx` (drag/snap), `measurements.ts` (pure: `buildMeasurements`/`selectMeasurements`/`cursorRelevance`/`elementOffsets`, `Box`/`Measurement`/`Selected`), `heroDom.ts` (`measureBoxes`, `applyTransform`, `FAST_EASE`, `queryReactiveEls`, `PlacementMap`), `DimensionArrow.tsx` (+`GuideLine`), `stageScale.ts` (`clientToStage`). Keep `measurements.ts` + `heroDom.ts` (reused). **Replace** `MeasureLayer` + `DragLayer` with one `InteractionLayer`.

**Tech:** React (mount only), imperative DOM + `requestAnimationFrame`, Motion springs optional, SVG, Vitest. The grid engine (`src/grid/*`) for the morphing grids.

---

## emil principles applied (the why)

| Symptom | Cause | Fix |
|---|---|---|
| Lag / choppy | React `setState` every pointer frame re-renders all arrows | Drive everything in ONE imperative rAF loop; React mounts a fixed pool of arrow elements once |
| Lag / choppy | `getBoundingClientRect` on ~30 els every frame (layout thrash) while also transforming them | Cache resting boxes once (mount + ResizeObserver + on placement change); compute from the cache |
| Arrow trails the cursor | 90ms transition on the arrow's `left/top` | Arrow position = imperative `transform` each frame, **no transition** (tracks 1:1) |
| Stale arrows on fast move | rAF/state race; pointerleave missed | The loop sets every arrow's visibility from current state each frame → can't go stale |
| Movement feels mechanical | direct mouse→value | Spring the element nudges (lerp toward target each frame ≈ a spring); decorative motion per emil |

Only animate `transform`/`opacity`. Arrow fade in/out = `opacity` transition 150ms `cubic-bezier(0.23,1,0.32,1)`. Respect `prefers-reduced-motion` (no nudges/morph; arrows static).

---

## Task 1 — `src/hero/collision.ts` (pure + tested)

```ts
export interface Rect { x: number; y: number; w: number; h: number }

/** Push overlapping label rects apart (minimal perpendicular displacement) so none overlap.
 * Returns a dy per index (labels nudge vertically off each other). Deterministic, stable order. */
export function resolveLabelCollisions(labels: Rect[]): number[]

/** Does segment/arrow rect `a` intersect any word rect in `words`? (axis-aligned). */
export function crossesAny(a: Rect, words: Rect[]): boolean

/** Clamp per-element nudge offsets so no two element boxes overlap after nudging. Returns the
 * clamped offsets plus the ids that were corrected (for the auto-correction annotation). */
export function preventOverlap(
  boxes: { id: string; x: number; y: number; w: number; h: number }[],
  offsets: Map<string, { dx: number; dy: number }>,
): { offsets: Map<string, { dx: number; dy: number }>; corrected: string[] }
```

- [ ] TDD `collision.test.ts`: two overlapping labels get pushed apart to non-overlapping; non-overlapping labels unchanged (dy 0); `crossesAny` true when an arrow rect overlaps a word, false otherwise; `preventOverlap` clamps two elements nudged into each other so their boxes don't overlap and reports them in `corrected`; deterministic.
- [ ] Implement; `npx vitest run src/hero/collision.test.ts` green. Commit `feat(hero): collision-resolution geometry`.

---

## Task 2 — `src/hero/MorphGrid.tsx` (whisper-subtle engine grids)

A faint, GPU-cheap layer in the negative space that **blooms on interaction and morphs**.

Contract: `<MorphGrid activityRef cursorRef />` where `activityRef` is a `{ current: number }` 0..1 interaction-intensity (driven by the InteractionLayer from cursor velocity/presence) and `cursorRef` is the artboard cursor point.

Behavior:
- Renders a faint cream grid (hairlines, very low opacity) from the real engine (`generate('recursive'|'nature'|'modular', seed)` via `src/grid/generators`) into an absolutely-positioned SVG sized to the artboard, clipped to the empty regions (above the composition / in the side margins — primarily `y < 540`).
- **Whisper-subtle:** overall opacity = `f(activity)` — ~0 at rest, rising to a low max (≤ ~0.18) as the user interacts, easing back out when idle. Pristine when untouched.
- **Morph/shuffle:** every few seconds while active (and/or on a fresh interaction burst), morph to a new grid — interpolate guide positions toward the new grid over ~600ms `cubic-bezier(0.77,0,0.175,1)`, or crossfade with a subtle `blur(2px)` bridge (emil's crossfade trick). Cells can stagger in (30–80ms). All `transform`/`opacity` only.
- Near the cursor, intensify locally (a soft radial falloff raising nearby line opacity), so it feels alive where you are.
- No `Math.random`/`Date.now` in render; seed from a counter; time via the rAF clock passed in or `performance.now` inside the imperative loop only (not in React render). Determinism for tests isn't required (visual layer), but keep it stable/seeded.

- [ ] Implement; orchestrator verifies the look live. Commit `feat(hero): whisper-subtle morphing engine grids`.

---

## Task 3 — `src/hero/InteractionLayer.tsx` (the unified imperative engine) + `Hero.tsx`

Replaces `MeasureLayer` + `DragLayer`. **One mode**: hover measures, pointer-drag on a word/block moves it. Remove the `measure/layout` toggle from `Hero.tsx` (keep a quiet `reset` that appears only when placements exist; keep the `R` shortcut; drop `L`). Mount `<MorphGrid>` + `<InteractionLayer>`.

Architecture (no React state in the hot path — all refs + imperative DOM):

```
refs: pointer{x,y,active}, boxes (cached resting Box[]), placement, drag (null|state),
      applied Map<id,{dx,dy}> (lerped), activity 0..1, arrowPool (N≈8 element refs)

remeasure(): getBoundingClientRect for all reactive els -> boxes (artboard coords, minus current
  applied). Call on mount, ResizeObserver(stage), and after placement changes. NOT per frame.

pointermove (window): write pointer ref (artboard coords); bump activity; DO NOT setState.
pointerdown on [data-word],[data-block]: begin drag (origin from cached boxes).
pointerup: commit placement (setState — rare), remeasure().

rAF loop (always running while mounted):
  const p = pointer; decay activity toward target.
  if (drag) {
    compute snapped delta (reuse DragLayer snap math vs cached boxes); write dragged el transform
      imperatively (instant); build drag annotations (4 border arrows + nearest neighbor gaps +
      guide lines) -> assign to arrow pool.
  } else if (p.active) {
    sel = selectMeasurements(buildMeasurements(boxes, ARTBOARD).filter(margin<=MAX_MARGIN), p,
            {maxCount, radius});
    targetOffsets = elementOffsets(sel, DELTA); 
    {offsets, corrected} = preventOverlap(boxes, targetOffsets);   // words never overlap
    assign sel arrows to pool: each arrow positioned at its cursor-tracked point (instant), length
      = opened gap / margin, label = clean positive value; then resolveLabelCollisions so numbers
      never overlap; ensure no arrow rect crossesAny(word) (nudge arrow off the word if so);
      draw a small tick/annotation for each `corrected` element.
  } else { targetOffsets = empty }
  // spring nudges: for every reactive el, applied[id] += (target - applied[id]) * LERP; write
  //   transform = translate(placement+applied) imperatively (no CSS transition).
  // arrow pool: for each pool slot, set transform/size/label and opacity (fade via 150ms opacity
  //   transition); hide unused slots (opacity 0).
  // activity -> MorphGrid via activityRef.

cleanup: cancelAnimationFrame; remove listeners; ResizeObserver disconnect.
```

Details:
- **Spring nudges:** `LERP ≈ 0.22` per frame (snappy, settles ~8 frames); cap so it never overshoots into overlap (preventOverlap already clamps targets).
- **Arrows track instantly:** pooled arrow elements use `transform: translate(...)` set each frame with **no transition** on transform; only `opacity` transitions (150ms) for appear/disappear.
- **Arrow pool:** ~8 reused `<div><svg>…</svg></div>` elements rendered once by React; the loop writes their transform/size/label/opacity. Gap arrows + margin arrows + drag annotations all draw from this pool.
- **Collision:** labels via `resolveLabelCollisions`; arrows checked with `crossesAny` against word boxes and nudged perpendicular off any word they'd cross; corrected-overlap elements get a small annotation (a short double-tick / "≠" mark) at their touching edge.
- **Unified affordance:** on hover over a draggable element set `cursor: grab` (via the stage), `grabbing` while dragging.
- **Reduced motion:** skip nudges + grid morph + spring (snap to target 0); arrows still render statically at the measurement; respects the mediaquery (subscribe to `change`).
- **Hero.tsx:** remove the `ModeToggle` mode switch (no measure/layout); render `<MorphGrid …/>` then `<InteractionLayer …/>`; keep `placement` + `reset`; the title/word/glyph render is UNCHANGED (do not touch the at-rest markup/spacing).

- [ ] Implement. Delete `MeasureLayer.tsx` + `DragLayer.tsx` (and their imports) once `InteractionLayer` subsumes them. `npm run typecheck && npm test && npm run build` green. Orchestrator does the live feel-tuning (LERP, radius, MAX_COUNT, fade, snap, grid intensity/morph cadence). Commit `feat(hero): unified imperative interaction engine (buttery)`.

---

## Acceptance (orchestrator-verified live)
- **Buttery:** sweeping the cursor fast = zero jank, zero stale arrows, arrows track 1:1, nudges spring smoothly. (Frame budget: the loop must not call `getBoundingClientRect` per frame.)
- **One mode:** hover measures; dragging a word moves it with live annotations + snap; release stays; reset restores Figma exactly.
- **Collisions:** numbers never overlap; arrows never sit on top of words; nudged words never overlap (auto-correction annotated).
- **Grids:** pristine at rest; faint engine grids bloom + morph in the negative space as you interact; fade out when idle.
- **At rest:** byte-identical Figma composition; renders without JS; reduced-motion respected.
- `npm run typecheck && npm test && npm run build` green (existing 103 tests pass; +collision tests).

## Build order
1. `collision.ts` (+tests).  2. `MorphGrid.tsx`.  3. `InteractionLayer.tsx` + `Hero.tsx` rewire; remove old layers.  4. Orchestrator live-tunes the feel.
