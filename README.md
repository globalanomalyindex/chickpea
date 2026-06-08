# Chickpea

**A generative grid studio that lets you see the math behind the grid.**

Grids are the invisible scaffolding of design — the system every poster, page, and
screen is built on, and the one thing most tools take pains to hide. Chickpea does the
opposite. It generates compositions on grids that are *always provably correct*, and it
will draw you its own skeleton on demand: the ratios, the modules, the spacing, rendered
as live dimension arrows. A composition becomes a teaching object. The tool teaches the
system it uses.

Three surfaces: **`/`** the alive hero · **`/studio`** the generator · **`/case`** the case study.

## What it does

- **An alive hero.** A Swiss-rational landing composition, pixel-faithful at rest, that
  comes apart under the cursor: the nearest seam spring-separates and a dimension arrow
  measures the gap it just opened.
- **Three grid families, all provably correct.** Recursive subdivision (gap-free tilings),
  nature-math (golden-section / φ subdivisions), and classic Swiss modular lattices —
  every grid generated from a single seeded function.
- **Image bisection → infinite variations.** Drop an image, make rough human cuts; Chickpea
  snaps them to ratio-correct anchors and generates endless mathematically-flawless
  variations that honor your intent.
- **Reveal the math.** A toggle overlays any composition's guides, module dimensions, and
  ratio labels (`φ`, `√2`, `3:5`) in the same dimension-arrow language as the hero.
- **Export.** PNG and SVG (with embedded fonts), or the bare grid blueprint for designers
  who want the system, not the dressing. Every composition lives in a shareable seeded URL.

## Stack

React · TypeScript · Vite · react-router · Motion (Framer Motion) · Vitest · SVG render
and export. No WebGL, no icon library — every mark is inline hairline SVG. Static build,
deployable to Vercel or Netlify.

## Run it

```bash
npm install
npm run dev        # local dev server
```

```bash
npm run typecheck  # tsc
npm test           # Vitest unit + invariant suite
npm run build      # production build → dist/
npm run preview    # serve the production build
```

## Why it's built this way

The intellectual core is a set of **pure, seeded generators** — `(seed, params) => Grid`,
with no React anywhere near them. That buys two things a portfolio piece should be able to
prove rather than merely claim:

- **Correctness is enforced, not asserted.** An invariant suite checks that tiling
  generators cover the canvas with zero gaps and zero overlaps, that every guide and module
  lands in `[0,1]`, that modular edges align to the declared lattice, and that each ratio
  label matches the proportion it actually measured. "Mathematically correct, always" is a
  test, not a tagline.
- **Determinism is the sharing mechanism.** The same `(seed, params)` always yields a
  byte-identical grid, so a URL is a reproducible composition and the case-study figures are
  built *out of the real engine* — live and interactive — rather than from screenshots.

Everything downstream (rendering, composition, export, the case-study figures) is
generator-agnostic and consumes the one `Grid` type, so the surfaces compose into a single
coherent product.

---

Built end-to-end — design, grid math, interaction, tests, and deploy — by
**Christopher Robin Fiore**.
