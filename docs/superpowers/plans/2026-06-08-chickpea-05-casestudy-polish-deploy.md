# Chickpea Plan 5 — Case Study + Polish + Deploy

> **For agentic workers:** superpowers:subagent-driven-development / executing-plans. Mostly UI + content + config; orchestrator-verified in the live preview. The case study reuses the real grid engine for live figures (not screenshots).

**Goal:** Ship Chickpea as a complete, deployable portfolio piece: a designed **case-study page** that narrates the work (with live, interactive math figures built from the real engine), a **polish pass** (meta/title/OG, favicon, reduced-motion, responsive sanity, hero→studio link, composition contrast), a **README**, and **deploy config** (SPA rewrites) with a verified production build.

**Architecture:** New route `/case` rendering the narrative from a content module + reusable figure components that wrap `GridSvg`/the generators/`DimensionArrow`. Polish touches existing files. Deploy = static Vite build + SPA-fallback config for Vercel/Netlify.

**Tech Stack:** React, TS, Vite, the existing Chickpea modules. Builds on Plans 1–4.

**Spec:** `docs/superpowers/specs/2026-06-08-chickpea-design.md` (§6 case study, §13 role alignment).

---

## File Structure

```
src/app/routes/CaseStudyRoute.tsx
src/case/CaseStudy.tsx            # the narrative page
src/case/Figure.tsx               # reusable live-figure frame (caption + the interactive bit)
src/case/figures/*.tsx            # SubdivisionFigure, GoldenFigure, ModularFigure, MeasureFigure
src/case/content.ts               # section copy (single source, easy to edit)
index.html                        # title + meta + OG
public/favicon.svg
public/_redirects                 # Netlify SPA fallback
vercel.json                       # Vercel SPA rewrite
README.md
src/app/App.tsx                   # add /case
src/hero/Hero.tsx / src/studio/Studio.tsx  # small polish + nav links
```

---

## Task 1: Meta, favicon, README

- [ ] **Step 1: `index.html`** — set `<title>Chickpea — a generative grid studio</title>`, a meta description ("Chickpea generates mathematically-correct grids you can see the math behind — a generative grid studio by Christopher Robin Fiore."), Open Graph + Twitter card tags (title, description, type=website), `<meta name="theme-color" content="#5d646b">`, and link the favicon.
- [ ] **Step 2: `public/favicon.svg`** — a tiny, on-brand mark: a cream chickpea/circle on slate, or a minimal grid glyph. Keep it crisp at 16px.
- [ ] **Step 3: `README.md`** — what Chickpea is (the thesis), a one-glance feature list (alive hero, three grid families, image bisection → variations, reveal-the-math, export), the stack, `npm install && npm run dev`, the build/test commands, and a short "why it's built this way" (pure seeded generators, invariant tests). Write it as a portfolio artifact, tight and confident.
- [ ] **Step 4: Commit** `chore: meta tags, favicon, README`

---

## Task 2: Case-study figures (live, from the real engine)

**Files:** `src/case/Figure.tsx`, `src/case/figures/*.tsx`

- [ ] **Step 1: `Figure.tsx`** — a frame: a number/label, the interactive figure, and a caption, in the design language (cream/mono, generous space).
- [ ] **Step 2: figures** (each a small, self-contained interactive):
  - `SubdivisionFigure` — a `GridSvg` of `generateRecursive` with a slider for `targetModules`; shows live the tiling staying gap-free.
  - `GoldenFigure` — `generateNature`; a slider for `depth`; a `φ` annotation via `DimensionArrow`.
  - `ModularFigure` — `generateModular`; sliders for columns/rows; the lattice updates live.
  - `MeasureFigure` — a tiny strip of letters/blocks that reveals spacing on hover (a compact echo of the hero Measure idea), or reuse a small composition with the skeleton reveal toggled.
  Each is deterministic, fast, and reuses existing pure modules — no new math.
- [ ] **Step 3: Orchestrator visual check** of each figure. **Step 4: Commit** `feat(case): live interactive figures`

---

## Task 3: Case-study page + content

**Files:** `src/case/content.ts`, `src/case/CaseStudy.tsx`, `src/app/routes/CaseStudyRoute.tsx`, `src/app/App.tsx`

- [ ] **Step 1: `content.ts`** — the narrative copy in sections (keep it tight, confident, designerly):
  1. **Title** — "Chickpea — making the grid visible." Subtitle: a generative grid studio.
  2. **The problem** — grids are invisible scaffolding; most tools hide the system instead of teaching it.
  3. **The idea** — a generator that is always mathematically correct *and* reveals its own math; an interface that comes alive under the cursor.
  4. **The math** — three families (recursive subdivision, golden/nature ratios, Swiss modular), each provably correct; intro the live figures.
  5. **Human intent in, math out** — image bisection: rough human cuts snapped to ratio-correct positions, then infinite variations.
  6. **The craft** — the alive hero, the Measure primitive, springs and contrast decisions.
  7. **The engineering** — pure seeded generators, invariant tests (zero-gap tiling, determinism), shareable seeds; built end-to-end in React/TS.
  8. **Close** — links to the live studio + hero.
- [ ] **Step 2: `CaseStudy.tsx`** — render the sections with the figures interleaved; editorial layout, big type, generous whitespace, hairline rules, on a slate→cream rhythm. A back-to-top / nav to `/` and `/studio`.
- [ ] **Step 3:** add `<Route path="/case" .../>`; link it from the hero (a small "case study" affordance) and the studio rail.
- [ ] **Step 4: Orchestrator visual check** — reads well, figures work, on-brand. **Step 5: Commit** `feat(case): case-study narrative page`

---

## Task 4: Polish pass

- [ ] **Step 1: Reduced motion** — confirm `prefers-reduced-motion` disables the hero separation + heavy transitions across hero/studio/case; quick audit.
- [ ] **Step 2: Composition background contrast** — in `buildComposition`, choose the background as the palette color with the **largest luminance distance from the mean** (or a slightly darkened/neutral tone) so cells don't melt into the background; keep deterministic; keep tests green (update the distribution test only if needed).
- [ ] **Step 3: Hero→studio link** — verify it's keyboard-focusable and the hero stays Figma-faithful at rest.
- [ ] **Step 4: Responsive sanity** — at mobile (375) and tablet (768): hero scales (contain-fit already handles it; confirm no overflow), studio rail stacks or remains usable, case study reflows. Make minimal fixes (stack the studio rail under the canvas on narrow widths).
- [ ] **Step 5: Nav** — a consistent, minimal way to move between `/` (hero), `/studio`, `/case` (e.g., a tiny fixed corner nav in mono). Keep it restrained.
- [ ] **Step 6: Typecheck + tests + build green. Commit** `polish: reduced-motion, contrast, responsive, nav`

---

## Task 5: Deploy config + production build

- [ ] **Step 1: `vercel.json`** — SPA rewrite so deep links work:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
- [ ] **Step 2: `public/_redirects`** (Netlify) — `/*  /index.html  200`
- [ ] **Step 3:** confirm Vite `base` is `'/'` (default) and `npm run build` produces a working `dist/`. Verify by `npm run preview` and a quick check that `/studio` and `/case` deep-links resolve (SPA fallback in preview).
- [ ] **Step 4: Commit** `chore: SPA deploy config (Vercel + Netlify)`

> Actual deploy needs the user's hosting auth. Hand off: `npx vercel --prod` (or drag `dist/` to Netlify Drop). The orchestrator surfaces this.

---

## Self-Review

**Spec coverage:** §6 case study with live figures ✓ (Tasks 2–3); §13 role alignment surfaced in the narrative + README ✓; polish (reduced-motion, responsive, contrast, nav) ✓ (Task 4); deploy-ready ✓ (Task 5). 

**Placeholder scan:** content.ts holds real copy; figures reuse tested engine code; configs are concrete.

**Type consistency:** figures consume `generateRecursive/Nature/Modular` + `GridSvg` + `DimensionArrow` unchanged. Background-contrast change keeps `buildComposition`'s signature + the distribution invariant.

**Deferred:** Playwright visual-regression suite (the orchestrator does live visual verification instead; a CI suite can follow). Analytics/SEO beyond basic meta.
