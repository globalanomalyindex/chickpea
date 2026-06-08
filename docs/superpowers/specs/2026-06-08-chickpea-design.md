# Chickpea — Design Spec

**Date:** 2026-06-08
**Status:** Brainstormed, approved for planning
**Author:** Christopher Robin Fiore (with Claude)
**Supersedes:** `2026-05-22-typ0glyphie-design.md` (typ0glyphie was a text tool; Chickpea is a grid generator)

## What it is

Chickpea is a browser-based **generative grid studio** and portfolio piece. It generates compositions on grids that are **always provably mathematically correct**, drawn from a library of generation strategies rooted in mathematics — classic Swiss modular grids, recursive subdivision, and "nature-math" ratios (golden ratio, root rectangles, Fibonacci, phyllotaxis). Users generate grids from scratch and iterate, or seed grids by **bisecting an uploaded image**: their human cuts become anchors, and Chickpea produces infinite variations that honor that intent while perfecting the math. Output is a finished **generative composition** (grid + palette + squeeze-fit typography), exportable as PNG or SVG.

Its signature idea — the spine connecting every surface — is **making the invisible system visible**. The landing hero and every generated composition can reveal their own skeleton: the ratios, the modules, the spacing, drawn as animated dimension arrows. A poster becomes a teaching object. The tool *teaches the system it uses.*

This is a portfolio piece targeting two Anthropic roles — **Design Engineer (AI Capability Development, Education Labs)** and **Product Designer (Claude Code)** — and is built to authentically demonstrate the craft both reward (see §13).

## What it evolves from

typ0glyphie was a brutalist text-in-cells tool (upload → transform → sections → compose → background → export). Several of its systems are **pure, proven, and re-pointed** at Chickpea rather than rebuilt:

- **Cursor-entry-direction gesture** (old §3) → the image **bisection** interaction.
- **k-means palette extraction + dyadic square-packing swatch** (old §5) → composition palettes.
- **Squeeze-fill typography algorithm** (old §6) → text inside grid modules.
- **PNG / SVG export with embedded fonts** (old §8) → composition + grid-blueprint export.
- **Designer-precision numeric readouts** ethos → the dimension-arrow / reveal visual language.

Dropped from the old scope for v1: PixiJS mesh-warp / perspective image transform (not needed; bisection works on the raw image), and the linear multi-step wizard (Chickpea is a single fluid studio).

## Aesthetic & feel

- **Swiss-rational, but alive.** Mathematical grids, hairline rules, exact numeric readouts — expanded with motion that gives the system apparent life.
- **Brand voice:** Mafinest (warm, rounded display) for headlines; a clean mono for numeric readouts.
- **Palette (from the Figma hero, exact):** background slate `#5d646b`, cream `#f4f0e8`, steel-blue accent `#4e6a7a`.
- **The unifying gesture:** the dimension arrow. The same `↔ / ↕` + live value language appears in the hero, the composition skeleton-reveal, and the case-study figures.

## Scope (v1)

Three surfaces, one design language:

1. **Hero** — a landing page **pixel-faithful to the Figma** (dashed rectangle cut), made *alive* by a cursor-driven Measure layer.
2. **Studio** — the generator: generate-from-scratch + iterate, image bisection → seeded variations, composition rendering, PNG/SVG export.
3. **Case study** — a designed page narrating the problem, the math, the interaction design, and the engineering (explicit portfolio storytelling; both roles value writing/presentation).

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **React + Vite + TypeScript** | Standard, fast, matches both roles' React/TS ask |
| Routing | **react-router** | Clean shareable URLs (`/studio?...` carries the seed) |
| Animation | **Motion** (Framer Motion) | Springs + layout + shared-element = the alive feel |
| Grid render / export | **SVG** | Crisp, annotatable, exports losslessly |
| Image / raster | **Canvas 2D** | Palette sampling, working bitmap, PNG export |
| State | **Zustand** + `persist` | Lightweight, localStorage built in |
| Blob persistence | **IndexedDB** | Uploaded image + fonts survive refresh |
| Randomness | **seeded PRNG** (mulberry32) | Reproducible "infinite variations"; seed in URL |
| Font loading | **FontFace API** + IndexedDB | User-uploaded TTF/OTF |
| Testing | **Vitest** + **Playwright** | Pure generators are provably testable; interaction + visual regression |
| Deploy | **Static (Vercel)** | Portfolio-ready, fast |

No WebGL in v1. No icon library — inline hairline SVG.

---

## §1 · The grid engine (intellectual core)

All generators are **pure functions** `(seed: number, params) => Grid` with no React imports. One unified type flows downstream, so rendering, composition, and export are generator-agnostic.

### Data model

```ts
type Axis = 'v' | 'h'
interface Guide { axis: Axis; pos: number }          // normalized 0..1
interface Module { x: number; y: number; w: number; h: number }  // normalized rect
interface RatioRef { name: string; value: number }   // provenance for annotations
type GeneratorKind = 'modular' | 'nature' | 'recursive' | 'blend'

interface Grid {
  id: string
  seed: number
  generator: GeneratorKind
  params: GeneratorParams                 // discriminated union per kind
  aspect: number                          // canvas w/h
  guides: Guide[]
  modules: Module[]                       // the addressable cells
  ratios: RatioRef[]                      // what math produced this grid
  meta: Record<string, unknown>           // generator-specific provenance for the reveal
}
```

### The generator library

- **`modular` (classic Swiss).** Margins (fraction), `C` columns ∈ [2..12], gutter, `R` rows, baseline. Modules = the column×row lattice, with optional random merging of adjacent cells into spanning blocks (still lattice-aligned). Müller-Brockmann, randomized strictly within the rules.

- **`nature` (nature-math).** Page proportion chosen from {φ ≈ 1.618, √2, √3, 1}. Three sub-strategies, seed-selected:
  - *Golden subdivision* — repeatedly divide the canvas at the golden-section point, alternating axis (the whirling-squares spiral); guides land at φ positions.
  - *Fibonacci columns* — column/row widths follow a normalized Fibonacci run (1,1,2,3,5,8…).
  - *Phyllotaxis seeding* — module seed points placed on the 137.5° golden-angle spiral, then snapped to a Fibonacci lattice to keep guides rational and the result a valid grid.

- **`recursive` (subdivision).** Start with the whole canvas as one cell; repeatedly pick a cell (area-weighted), split it along an axis at a ratio position, recurse to a target module count. Split positions drawn from a configurable set (½ dyadic, φ, √2, or a small rational set) — guaranteeing a **gap-free, overlap-free tiling**. Reuses the old dyadic square-packing idea.

- **`blend` (meta).** Composes families: e.g. a `recursive` subdivision whose split positions are constrained to the `nature` ratio set, or a `modular` grid whose merges follow Fibonacci. Parameterized by which families to mix.

### Correctness invariants (enforced in tests + dev assertions — `grid/invariants.ts`)

1. Every guide `pos` and module rect lies within `[0,1]` (± ε).
2. For tiling generators (`recursive`, and tiling `blend` modes): module union covers the full canvas and module interiors are pairwise disjoint (zero gaps/overlaps within ε).
3. For `modular`: every module edge aligns to the declared column/row lattice exactly.
4. Each `RatioRef.value` matches the actually-measured proportion within tolerance.
5. **Determinism:** the same `(seed, params)` always yields a byte-identical `Grid`.

These invariants are what make "mathematically correct, always" a guarantee the code *enforces*, not a claim.

### Variation & iteration

- **Generate** — new random seed → a fresh grid in the current family.
- **Iterate** — mutate the current params slightly (nudge one count, shift one axis, perturb a ratio choice) → a family of neighbors around the current grid (explore-around-here).
- **Seed in URL** — `(generator, seed, params)` serialize into the query string, so any composition is reproducible and shareable.

---

## §2 · Image → grid (bisection pipeline)

1. **Upload** an image (`io/image-io.ts`; PNG/JPG/WEBP/GIF first-frame).
2. **Bisect (optional)** via the **cursor-entry-direction gesture** (reused, `bisection/cursor-axis-detector.ts`): enter the image from top/bottom → vertical-cut mode; from left/right → horizontal-cut mode; click drops a cut. Corner-tie resolved by larger crossing displacement (deterministic). Cuts stored normalized 0..1.
3. **Palette** — k-means over the image (`palette/kmeans.ts`) → dyadic square-packing swatch (`palette/dyadic-layout.ts`).
4. **Anchor + generate** — the human cuts snap to the nearest ratio-correct positions for the chosen generator; the generator fills the remaining structure, producing infinite variations that **respect the cuts while perfecting the math**.
5. **Dress** — modules filled with palette colors and optional squeeze-fit type → a composition.

**Human intent in, mathematically-flawless variations out.**

---

## §3 · Composition rendering

`studio/CompositionCanvas.tsx` renders a `Grid` as a finished composition:

- Each module gets a palette color fill (assignment strategy seeded; e.g. dominant→largest module).
- Optional per-module text, squeeze-fit to the module rect via `type/typography-fit.ts` (one char → enormous; a sentence → flattened bar), in Mafinest or a chosen font.
- Background from the global palette or its average (reuses old §7 logic).
- Rendered as SVG (crisp, exportable); a Canvas 2D path exists for PNG raster.

### Skeleton reveal (`studio/SkeletonReveal.tsx`)

A toggle (and a hover/proximity mode) overlays the composition's math in the shared dimension-arrow language: guides as hairlines, module dimensions, ratio labels (`φ`, `√2`, `3:5`), and spacing arrows. This is the **same visual primitive** as the hero's Measure layer — systems thinking made visible.

---

## §4 · The alive hero (signature interaction)

The hero DOM mirrors the Figma composition **exactly** — positions, sizes, Mafinest, tracking, the three palette colors — scaled responsively but composition-faithful. It renders fully **without JavaScript** (progressive enhancement); the "exact preservation" requirement holds even if the alive layer never loads.

### The Measure layer (`hero/MeasureLayer.tsx`, `hero/useNearestSeam.ts`)

A reusable primitive. On pointer move it finds the **nearest seam** among: gaps between adjacent letters of "Chickpea", gaps between stacked text lines/words, and a faint background grid. Then:

- It **spring-separates** the two sides of the seam by a small delta (falloff with cursor distance, max ~24px), exposing the gap.
- It draws a **dimension arrow** (`components/DimensionArrow.tsx`) spanning the gap with the **live measured value** (px).
- Faint grid lines bloom near the cursor.
- On move-away / pointer-leave, everything **springs back** to the exact Figma positions.

Springs (not linear easing) give the elements apparent mass — the quality that reads as "alive" rather than merely "animated."

**Accessibility:** honors `prefers-reduced-motion` (reveal arrows without the springy separation). The static composition is always the truthful, Figma-exact fallback.

---

## §5 · Export (reused & extended)

- **PNG** — offscreen canvas at chosen dimensions, internally 2× then downsampled; background rect + per-module fills + per-module squeeze-fit text. `canvas.toBlob` → download.
- **SVG** — root sized to export dims; `<defs>` with base64-embedded `@font-face` for every referenced font (incl. uploaded blobs); background rect; per-module rects + `<text transform="matrix(...)" textLength>`; metadata `<title>`/`<desc>`.
- **Grid blueprint (bonus)** — export the bare grid (guides + module outlines + ratio annotations) as SVG, for designers who want the system, not the dressing.
- **Naming:** `chickpea-{YYYYMMDD-HHMMSS}.{png|svg}`.

---

## §6 · Case-study page (`app/routes/CaseStudyRoute.tsx`)

A designed page in the same language, narrating:

- **The problem** — grids are invisible scaffolding most people never see.
- **The insight** — make the math visible *and* generative-yet-correct.
- **The math** — the three families, each with a small **live, scrubbable figure** (e.g. drag to watch a golden-section subdivision unfold).
- **The interaction design** — the Measure primitive and why springs make it feel alive.
- **The engineering** — pure generators, seeded determinism, the invariant suite.
- **Craft notes** — Figma fidelity, edge cases, the decisions behind the decisions.

Live figures reuse the same `grid/` engine and `DimensionArrow` primitive — the case study is built *out of the product*, not screenshots of it.

---

## §7 · State & persistence

**Zustand + `persist`:**

- **localStorage** (small state): current generator + params + seed, image bisection anchors, per-module composition (text/color/font), selected background, selected font, export settings, current route/seed.
- **IndexedDB** (blobs): uploaded source image, user-uploaded font binaries.

Single project at a time; opening a new image overwrites (explicit CLEAR affordance when prior state exists). Seed-in-URL is the sharing/reproduction mechanism. Schema `version: 1`.

Transient state (hover, spring progress, focused module) is **not** persisted; refresh lands on the same composition with a clean interaction state.

---

## §8 · Curated font set

Mafinest (Regular + Italic) is **vendored into the repo** from the user's local copy (`~/Downloads/Whole Shop Bundle by CSCO/Mafinest/`) into `public/fonts/`, with `@font-face` in `design/fonts.css`. A small curated set of free fonts (mono for readouts + a few display/sans/serif for composition type) ships alongside. Users may drag a TTF/OTF to register it via `FontFace.load()` and persist it to IndexedDB.

---

## §9 · Module breakdown

```
src/
  app/
    App.tsx                      # router + shell
    routes/
      HeroRoute.tsx
      StudioRoute.tsx
      CaseStudyRoute.tsx
  hero/
    Hero.tsx                     # Figma-faithful composition (renders w/o JS)
    MeasureLayer.tsx             # the alive cursor primitive
    useNearestSeam.ts            # seam detection
  studio/
    Studio.tsx
    GeneratorControls.tsx        # family pick, params, seed, generate / iterate
    ImageBisection.tsx           # upload + cursor-direction cuts
    CompositionCanvas.tsx        # grid + palette + type → SVG
    SkeletonReveal.tsx           # reveal-the-math overlay (shared language)
    ExportPanel.tsx
  grid/                          # PURE — no React
    types.ts
    prng.ts                      # mulberry32 seeded PRNG
    generators/
      modular.ts
      nature.ts                  # golden / root / fibonacci / phyllotaxis
      recursive.ts               # subdivision / dyadic
      blend.ts
      index.ts                   # registry
    invariants.ts                # correctness checks (tests + dev assert)
    annotate.ts                  # ratio / dimension annotations for reveal
  palette/                       # reused, pure
    kmeans.ts
    dyadic-layout.ts             # square packing
  type/                          # reused, pure
    typography-fit.ts            # squeeze fill
  bisection/
    cursor-axis-detector.ts      # entry-direction state machine (pure)
  io/
    image-io.ts
    font-io.ts                   # FontFace + IndexedDB
    export-svg.ts
    export-png.ts
  state/
    store.ts                     # Zustand + persist
    types.ts
  design/
    tokens.css                   # Figma tokens (colors, spacing)
    fonts.css                    # Mafinest @font-face
    global.css
  components/
    DimensionArrow.tsx           # shared SVG arrow + value (hero + reveal + case study)
    MonoReadout.tsx              # numeric readout text
public/
  fonts/                         # Mafinest (vendored) + curated set
```

Every `grid/`, `palette/`, `type/`, `bisection/` module is pure and unit-testable. UI files are thin orchestrators.

---

## §10 · Testing strategy

**Unit (Vitest):**
- `grid/generators/*` + `grid/invariants` — tiling covers/disjoint within ε; bounds; lattice alignment; ratio tolerance; **determinism** (same seed → identical grid).
- `palette/kmeans`, `palette/dyadic-layout` — count == k, deterministic with seed, rects tile a unit square.
- `type/typography-fit` — fill math; multi-line stacking; edge cases (1 char, very long, blank).
- `bisection/cursor-axis-detector` — all edge-crossing transitions incl. the corner-tie.
- `io/export-svg` — snapshot generated SVG for known compositions.

**Interaction + visual (Playwright):**
- Hero Measure layer: move cursor between "c" and "h" → arrow appears + letters separate; leave → reset to Figma-exact.
- Studio: generate → iterate → image upload → bisect → composition → export happy path.
- Visual-regression baselines, including a **Figma-fidelity baseline** of the hero static composition.

Canvas is rendered for real (no mocking); pixel assertions at known positions.

---

## §11 · Build order

1. Scaffold (Vite + React + TS) · tokens · vendor Mafinest · global shell · `DimensionArrow` primitive.
2. `grid/` pure engine: types, prng, `modular` + `recursive` + `nature` generators, invariants, full Vitest suite. (No UI.)
3. Hero: Figma-faithful static composition (visual-regression vs Figma) → then `MeasureLayer` alive enhancement.
4. Studio shell: `GeneratorControls` + `CompositionCanvas` (generate / iterate from scratch).
5. Reuse `palette/` + `type/` → dress compositions.
6. Image upload + `bisection` gesture → seeded variations honoring anchors.
7. Export PNG / SVG (+ grid-blueprint export).
8. `SkeletonReveal` overlay across compositions.
9. Case-study page with live scrubbable figures.
10. Polish: spring tuning, reduced-motion, perf, a11y-where-it-counts, Playwright + baselines, the final 10%.

---

## §12 · Out of scope (v1)

- Accounts, cloud sync, real-time collaboration.
- Mobile-first layout (responsive + touch fallback for gestures; desktop-primary).
- PixiJS mesh-warp / perspective image transform (deferred; bisection uses the raw image).
- AI-generative features (colors, text suggestions).
- CMYK / print color management (sRGB only).
- Multi-project library.

---

## §13 · Role alignment (portfolio intent)

| Role signal (quoted from the listings) | Where Chickpea proves it |
|---|---|
| "motion, polish, and interaction feel" | the Measure layer; spring separations; reveal language |
| full-stack "one-person technical shop" | design + grid math + React/TS + tests + deploy, end-to-end |
| "technology should enhance rather than diminish human capabilities" | the tool *teaches the system it uses*; reveals the math |
| "innovative interaction paradigms" / "rethinking the basics" | cursor-reveals-the-grid; generative-yet-provably-correct |
| "polished UI craftsmanship… the pixels, the copy, the edge cases" | Figma-faithful hero; invariant-guarded generators |
| "rapidly prototype… using front-end code" | the whole artifact is shipped, deployed front-end code |
| documentation / writing / presentations | the case-study page + a strong README |

---

## §14 · Orchestration (build phase)

Built by a director-led team of specialized agents, integrated by the lead who guards Figma fidelity and the "reveal the math" through-line:

1. **Design-system agent** — vendor Mafinest, extract exact Figma tokens, token + font layer.
2. **Grid-engine agent** — pure generators, `Grid` model, seeded PRNG, full invariant + Vitest suite.
3. **Alive-hero agent** — pixel-faithful hero + the Measure primitive + spring feel.
4. **Studio agent** — generator controls, image upload + bisection, palette, composition render, export.
5. **Case-study + polish/QA agent** — case-study page, Playwright visual regression, perf, a11y, the final 10%.

Each surface communicates through the shared `grid/` engine and `DimensionArrow` primitive, so the team's outputs compose into one coherent product.
