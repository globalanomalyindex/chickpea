# Chickpea Plan 1 — Foundation + Grid Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Chickpea app shell (Vite + React + TS, Figma design tokens, vendored Mafinest) and a fully-tested **pure grid engine** that generates provably-correct grids from three families (recursive, modular, nature), visualized on a dev page.

**Architecture:** All generators are pure functions `(seed, params) => Grid` with no React imports, driven by a seeded PRNG so output is deterministic and shareable. Correctness is enforced by an invariant suite (in-bounds, gap-free tiling, determinism) run as unit tests. A thin SVG renderer + dev route lets us see grids immediately.

**Tech Stack:** Vite, React 18, TypeScript, Vitest (jsdom), Motion, Zustand, react-router-dom. Mafinest font vendored from the user's local copy.

**Spec:** `docs/superpowers/specs/2026-06-08-chickpea-design.md` (§1 grid engine, §9 modules, §10 testing, §11 build order).

---

## File Structure (this plan)

```
package.json, vite.config.ts, tsconfig.json, tsconfig.node.json, index.html   # scaffold
src/main.tsx, src/app/App.tsx                                                  # shell + router
src/design/tokens.css, src/design/fonts.css, src/design/global.css            # tokens + Mafinest
public/fonts/Mafinest-Regular.otf, Mafinest-Italic.otf                        # vendored font
src/grid/types.ts            # Grid, Guide, Module, params unions
src/grid/prng.ts             # mulberry32 + rng helpers (PURE)
src/grid/generators/recursive.ts   # subdivision generator (PURE)
src/grid/generators/modular.ts     # Swiss modular generator (PURE)
src/grid/generators/nature.ts      # golden-section subdivision (PURE)
src/grid/generators/index.ts       # registry: kind -> { generate, randomParams }
src/grid/invariants.ts       # checkBounds / checkTiling (PURE, used by tests + dev assert)
src/grid/serialize.ts        # Grid descriptor <-> URLSearchParams (PURE)
src/components/GridSvg.tsx   # render a Grid as SVG
src/app/routes/DevRoute.tsx  # generate + render grids, seed input
src/test/setup.ts            # vitest setup
src/grid/**/*.test.ts        # unit tests
```

Each `src/grid/*` file is pure and independently testable. UI files are thin.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/test/setup.ts`, `.gitignore`

> We scaffold manually (not `npm create vite`) because the repo dir is non-empty and the interactive prompt would hang in a headless run.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chickpea",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "motion": "^11.11.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chickpea — a generative grid studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 4: Create `tsconfig.json` and `tsconfig.node.json`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Create `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './design/tokens.css'
import './design/fonts.css'
import './design/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 7: Create `src/app/App.tsx`** (minimal router; real routes added later)

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DevRoute } from './routes/DevRoute'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dev" element={<DevRoute />} />
        <Route path="*" element={<Navigate to="/dev" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules
dist
.DS_Store
*.local
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: completes, `node_modules/` populated, no peer-dep errors that block install.

- [ ] **Step 10: Commit** (DevRoute + design CSS don't exist yet — create empty placeholders only to make it run is NOT allowed; instead defer the commit until Task 1's CSS + Task 7's DevRoute exist. So: commit just the scaffold config now and temporarily point App at a stub.)

Temporarily replace `src/app/App.tsx` body with a stub so the app compiles before DevRoute exists:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<main style={{ padding: 24 }}>Chickpea — scaffold</main>} />
      </Routes>
    </BrowserRouter>
  )
}
```

Create empty `src/design/tokens.css`, `src/design/fonts.css`, `src/design/global.css` (filled in Task 1).

Run: `npm run dev` → open the printed URL → confirm "Chickpea — scaffold" renders. Stop the server.

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS app shell"
```

---

## Task 1: Design tokens + Mafinest font

**Files:**
- Modify: `src/design/tokens.css`, `src/design/fonts.css`, `src/design/global.css`
- Create: `public/fonts/Mafinest-Regular.otf`, `public/fonts/Mafinest-Italic.otf`

- [ ] **Step 1: Vendor the Mafinest font into the repo**

Run:
```bash
mkdir -p public/fonts
cp "$HOME/Downloads/Whole Shop Bundle by CSCO/Mafinest/Mafinest-Regular.otf" public/fonts/Mafinest-Regular.otf
cp "$HOME/Downloads/Whole Shop Bundle by CSCO/Mafinest/Mafinest-Italic.otf" public/fonts/Mafinest-Italic.otf
ls -la public/fonts
```
Expected: both `.otf` files present (~each tens of KB).

- [ ] **Step 2: `src/design/fonts.css`**

```css
@font-face {
  font-family: 'Mafinest';
  src: url('/fonts/Mafinest-Regular.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Mafinest';
  src: url('/fonts/Mafinest-Italic.otf') format('opentype');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
```

- [ ] **Step 3: `src/design/tokens.css`** (exact Figma values)

```css
:root {
  /* palette — from the Figma hero */
  --slate: #5d646b;
  --cream: #f4f0e8;
  --steel: #4e6a7a;

  /* type */
  --font-display: 'Mafinest', Georgia, serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, monospace;

  /* hairline */
  --hairline: 1px;

  /* spacing scale (px) */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-6: 24px;
  --s-8: 32px;
}
```

- [ ] **Step 4: `src/design/global.css`**

```css
* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--slate);
  color: var(--cream);
  font-family: var(--font-display);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 5: Verify the font loads**

Run: `npm run dev` → open `/` → DevTools Network shows `Mafinest-Regular.otf` 200. Add a temporary `<h1>Chickpea</h1>` to the stub if needed, confirm it renders in Mafinest, then revert. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: design tokens + vendored Mafinest font"
```

---

## Task 2: Grid types + PRNG

**Files:**
- Create: `src/grid/types.ts`, `src/grid/prng.ts`, `src/grid/prng.test.ts`

- [ ] **Step 1: Write `src/grid/types.ts`**

```ts
export type Axis = 'v' | 'h'

export interface Guide {
  axis: Axis
  pos: number // normalized 0..1
}

export interface Module {
  x: number
  y: number
  w: number
  h: number // all normalized 0..1
}

export interface RatioRef {
  name: string
  value: number
}

export type GeneratorKind = 'recursive' | 'modular' | 'nature'

export interface RecursiveParams {
  kind: 'recursive'
  targetModules: number
  splitRatios: number[]
  vBias: number // probability a split is vertical (cuts along x)
}

export interface ModularParams {
  kind: 'modular'
  columns: number
  rows: number
  margin: number
  gutter: number
}

export interface NatureParams {
  kind: 'nature'
  depth: number
}

export type GeneratorParams = RecursiveParams | ModularParams | NatureParams

export interface Grid {
  id: string
  seed: number
  generator: GeneratorKind
  params: GeneratorParams
  aspect: number
  guides: Guide[]
  modules: Module[]
  ratios: RatioRef[]
  meta: Record<string, unknown>
}
```

- [ ] **Step 2: Write the failing test `src/grid/prng.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { mulberry32, randInt, pick } from './prng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produces values in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)())
  })
})

describe('randInt', () => {
  it('stays within [min,max] inclusive', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 2, 5)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(5)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
})

describe('pick', () => {
  it('returns an element from the array', () => {
    const r = mulberry32(3)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) expect(arr).toContain(pick(r, arr))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/grid/prng.test.ts`
Expected: FAIL — cannot find module `./prng`.

- [ ] **Step 4: Write `src/grid/prng.ts`**

```ts
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/grid/prng.test.ts`
Expected: PASS (3 + 1 + 1 assertions green).

- [ ] **Step 6: Commit**

```bash
git add src/grid/types.ts src/grid/prng.ts src/grid/prng.test.ts
git commit -m "feat(grid): Grid types + seeded PRNG"
```

---

## Task 3: Invariants (the correctness contract)

**Files:**
- Create: `src/grid/invariants.ts`, `src/grid/invariants.test.ts`

- [ ] **Step 1: Write the failing test `src/grid/invariants.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { checkBounds, checkTiling } from './invariants'
import type { Module } from './types'

const EPS = 1e-9

describe('checkBounds', () => {
  it('accepts modules inside the unit square', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }]
    expect(checkBounds(mods, EPS)).toBe(true)
  })
  it('rejects a module that overflows', () => {
    const mods: Module[] = [{ x: 0.8, y: 0, w: 0.5, h: 1 }]
    expect(checkBounds(mods, EPS)).toBe(false)
  })
})

describe('checkTiling', () => {
  it('confirms a perfect 2-cell split covers and is disjoint', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.382, h: 1 }, { x: 0.382, y: 0, w: 0.618, h: 1 }]
    const r = checkTiling(mods, 1e-6)
    expect(r.covered).toBe(true)
    expect(r.disjoint).toBe(true)
  })
  it('detects a gap', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.3, h: 1 }, { x: 0.4, y: 0, w: 0.6, h: 1 }]
    expect(checkTiling(mods, 1e-6).covered).toBe(false)
  })
  it('detects an overlap', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.4, y: 0, w: 0.6, h: 1 }]
    expect(checkTiling(mods, 1e-6).disjoint).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/grid/invariants.test.ts`
Expected: FAIL — cannot find module `./invariants`.

- [ ] **Step 3: Write `src/grid/invariants.ts`**

```ts
import type { Module } from './types'

export function checkBounds(modules: Module[], eps = 1e-9): boolean {
  return modules.every(
    (m) =>
      m.x >= -eps &&
      m.y >= -eps &&
      m.w > eps &&
      m.h > eps &&
      m.x + m.w <= 1 + eps &&
      m.y + m.h <= 1 + eps,
  )
}

function overlapArea(a: Module, b: Module): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return ox * oy
}

export function checkTiling(
  modules: Module[],
  eps = 1e-6,
): { covered: boolean; disjoint: boolean; area: number; overlap: number } {
  const area = modules.reduce((s, m) => s + m.w * m.h, 0)
  let overlap = 0
  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      overlap += overlapArea(modules[i], modules[j])
    }
  }
  return {
    covered: Math.abs(area - 1) <= eps && overlap <= eps,
    disjoint: overlap <= eps,
    area,
    overlap,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/grid/invariants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/grid/invariants.ts src/grid/invariants.test.ts
git commit -m "feat(grid): tiling + bounds invariants"
```

---

## Task 4: Recursive subdivision generator

**Files:**
- Create: `src/grid/generators/recursive.ts`, `src/grid/generators/recursive.test.ts`

- [ ] **Step 1: Write the failing test `src/grid/generators/recursive.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { generateRecursive, defaultRecursiveParams } from './recursive'
import { checkBounds, checkTiling } from '../invariants'

describe('generateRecursive', () => {
  it('produces exactly targetModules cells', () => {
    const g = generateRecursive(123, { ...defaultRecursiveParams, targetModules: 9 })
    expect(g.modules.length).toBe(9)
  })

  it('tiles the unit square with no gaps or overlaps', () => {
    for (const seed of [1, 2, 42, 999, 100000]) {
      const g = generateRecursive(seed, defaultRecursiveParams)
      expect(checkBounds(g.modules)).toBe(true)
      const t = checkTiling(g.modules)
      expect(t.covered).toBe(true)
      expect(t.disjoint).toBe(true)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = generateRecursive(7, defaultRecursiveParams)
    const b = generateRecursive(7, defaultRecursiveParams)
    expect(a.modules).toEqual(b.modules)
    expect(a.guides).toEqual(b.guides)
  })

  it('different seeds give different layouts', () => {
    const a = generateRecursive(1, defaultRecursiveParams)
    const b = generateRecursive(2, defaultRecursiveParams)
    expect(a.modules).not.toEqual(b.modules)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/grid/generators/recursive.test.ts`
Expected: FAIL — cannot find module `./recursive`.

- [ ] **Step 3: Write `src/grid/generators/recursive.ts`**

```ts
import { mulberry32, pick, type Rng } from '../prng'
import type { Grid, Guide, Module, RecursiveParams } from '../types'

export const defaultRecursiveParams: RecursiveParams = {
  kind: 'recursive',
  targetModules: 9,
  splitRatios: [0.5, 0.382, 0.618],
  vBias: 0.5,
}

function largestIndex(modules: Module[]): number {
  let idx = 0
  for (let i = 1; i < modules.length; i++) {
    if (modules[i].w * modules[i].h > modules[idx].w * modules[idx].h) idx = i
  }
  return idx
}

export function generateRecursive(seed: number, params: RecursiveParams): Grid {
  const rng: Rng = mulberry32(seed)
  const modules: Module[] = [{ x: 0, y: 0, w: 1, h: 1 }]
  const guides: Guide[] = []

  while (modules.length < params.targetModules) {
    const idx = largestIndex(modules)
    const m = modules[idx]
    const vertical = rng() < params.vBias
    const r = pick(rng, params.splitRatios)
    let a: Module
    let b: Module
    if (vertical) {
      const cut = m.x + m.w * r
      guides.push({ axis: 'v', pos: cut })
      a = { x: m.x, y: m.y, w: m.w * r, h: m.h }
      b = { x: cut, y: m.y, w: m.w * (1 - r), h: m.h }
    } else {
      const cut = m.y + m.h * r
      guides.push({ axis: 'h', pos: cut })
      a = { x: m.x, y: m.y, w: m.w, h: m.h * r }
      b = { x: m.x, y: cut, w: m.w, h: m.h * (1 - r) }
    }
    modules.splice(idx, 1, a, b)
  }

  return {
    id: `recursive-${seed}`,
    seed,
    generator: 'recursive',
    params,
    aspect: 1,
    guides,
    modules,
    ratios: [{ name: 'φ', value: 1.618 }],
    meta: { strategy: 'area-weighted subdivision' },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/grid/generators/recursive.test.ts`
Expected: PASS (tiling holds because every split partitions one rectangle into two).

- [ ] **Step 5: Commit**

```bash
git add src/grid/generators/recursive.ts src/grid/generators/recursive.test.ts
git commit -m "feat(grid): recursive subdivision generator"
```

---

## Task 5: Modular (Swiss) generator

**Files:**
- Create: `src/grid/generators/modular.ts`, `src/grid/generators/modular.test.ts`

- [ ] **Step 1: Write the failing test `src/grid/generators/modular.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { generateModular, defaultModularParams, randomModularParams } from './modular'
import { checkBounds } from '../invariants'
import { mulberry32 } from '../prng'

describe('generateModular', () => {
  it('produces columns*rows modules', () => {
    const g = generateModular(5, { ...defaultModularParams, columns: 4, rows: 3 })
    expect(g.modules.length).toBe(12)
  })

  it('keeps every module inside the unit square (margins respected)', () => {
    for (const seed of [1, 9, 77, 5000]) {
      const g = generateModular(seed, randomModularParams(mulberry32(seed)))
      expect(checkBounds(g.modules)).toBe(true)
    }
  })

  it('aligns columns: modules in the same column share x and w', () => {
    const g = generateModular(1, { ...defaultModularParams, columns: 3, rows: 2 })
    const col0 = g.modules.filter((_, i) => i % 3 === 0)
    expect(col0[0].x).toBeCloseTo(col0[1].x, 10)
    expect(col0[0].w).toBeCloseTo(col0[1].w, 10)
  })

  it('is deterministic', () => {
    expect(generateModular(3, defaultModularParams).modules).toEqual(
      generateModular(3, defaultModularParams).modules,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/grid/generators/modular.test.ts`
Expected: FAIL — cannot find module `./modular`.

- [ ] **Step 3: Write `src/grid/generators/modular.ts`**

```ts
import { randInt, type Rng } from '../prng'
import type { Grid, Guide, Module, ModularParams } from '../types'

export const defaultModularParams: ModularParams = {
  kind: 'modular',
  columns: 6,
  rows: 4,
  margin: 0.06,
  gutter: 0.02,
}

export function randomModularParams(rng: Rng): ModularParams {
  return {
    kind: 'modular',
    columns: randInt(rng, 2, 12),
    rows: randInt(rng, 2, 10),
    margin: 0.04 + rng() * 0.06,
    gutter: 0.01 + rng() * 0.03,
  }
}

export function generateModular(seed: number, params: ModularParams): Grid {
  const { columns: C, rows: R, margin, gutter } = params
  const usableW = 1 - 2 * margin
  const usableH = 1 - 2 * margin
  const colW = (usableW - (C - 1) * gutter) / C
  const rowH = (usableH - (R - 1) * gutter) / R

  const guides: Guide[] = []
  for (let c = 0; c <= C; c++) guides.push({ axis: 'v', pos: margin + c * (colW + gutter) - (c > 0 ? gutter : 0) })
  for (let r = 0; r <= R; r++) guides.push({ axis: 'h', pos: margin + r * (rowH + gutter) - (r > 0 ? gutter : 0) })

  const modules: Module[] = []
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      modules.push({
        x: margin + c * (colW + gutter),
        y: margin + r * (rowH + gutter),
        w: colW,
        h: rowH,
      })
    }
  }

  return {
    id: `modular-${seed}`,
    seed,
    generator: 'modular',
    params,
    aspect: 1,
    guides,
    modules,
    ratios: [{ name: 'columns:rows', value: C / R }],
    meta: { columns: C, rows: R },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/grid/generators/modular.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/grid/generators/modular.ts src/grid/generators/modular.test.ts
git commit -m "feat(grid): Swiss modular generator"
```

---

## Task 6: Nature (golden-section) generator

**Files:**
- Create: `src/grid/generators/nature.ts`, `src/grid/generators/nature.test.ts`

- [ ] **Step 1: Write the failing test `src/grid/generators/nature.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { generateNature, defaultNatureParams } from './nature'
import { checkBounds, checkTiling } from '../invariants'

const PHI = 1.6180339887

describe('generateNature', () => {
  it('tiles the unit square via golden subdivision', () => {
    for (const seed of [1, 2, 42, 8080]) {
      const g = generateNature(seed, defaultNatureParams)
      expect(checkBounds(g.modules)).toBe(true)
      const t = checkTiling(g.modules)
      expect(t.covered).toBe(true)
      expect(t.disjoint).toBe(true)
    }
  })

  it('cuts at the golden section (a child width ratio ≈ 1:φ on the first split)', () => {
    const g = generateNature(1, { ...defaultNatureParams, depth: 1 })
    expect(g.modules.length).toBe(2)
    const widths = g.modules.map((m) => m.w * m.h) // areas, since one axis is full
    const ratio = Math.max(...widths) / Math.min(...widths)
    expect(ratio).toBeCloseTo(PHI, 2)
  })

  it('produces depth+1 modules and is deterministic', () => {
    const g = generateNature(3, { ...defaultNatureParams, depth: 6 })
    expect(g.modules.length).toBe(7)
    expect(generateNature(3, { ...defaultNatureParams, depth: 6 }).modules).toEqual(g.modules)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/grid/generators/nature.test.ts`
Expected: FAIL — cannot find module `./nature`.

- [ ] **Step 3: Write `src/grid/generators/nature.ts`**

```ts
import { mulberry32, type Rng } from '../prng'
import type { Grid, Guide, Module, NatureParams } from '../types'

const INV_PHI = 0.6180339887 // 1/φ

export const defaultNatureParams: NatureParams = {
  kind: 'nature',
  depth: 6,
}

function largestIndex(modules: Module[]): number {
  let idx = 0
  for (let i = 1; i < modules.length; i++) {
    if (modules[i].w * modules[i].h > modules[idx].w * modules[idx].h) idx = i
  }
  return idx
}

export function generateNature(seed: number, params: NatureParams): Grid {
  const rng: Rng = mulberry32(seed)
  const modules: Module[] = [{ x: 0, y: 0, w: 1, h: 1 }]
  const guides: Guide[] = []
  let vertical = rng() < 0.5 // first axis chosen by seed; alternates thereafter

  for (let i = 0; i < params.depth; i++) {
    const idx = largestIndex(modules)
    const m = modules[idx]
    // golden cut: place the larger part on a seed-chosen side
    const bigFirst = rng() < 0.5
    const r = bigFirst ? INV_PHI : 1 - INV_PHI
    let a: Module
    let b: Module
    if (vertical) {
      const cut = m.x + m.w * r
      guides.push({ axis: 'v', pos: cut })
      a = { x: m.x, y: m.y, w: m.w * r, h: m.h }
      b = { x: cut, y: m.y, w: m.w * (1 - r), h: m.h }
    } else {
      const cut = m.y + m.h * r
      guides.push({ axis: 'h', pos: cut })
      a = { x: m.x, y: m.y, w: m.w, h: m.h * r }
      b = { x: m.x, y: cut, w: m.w, h: m.h * (1 - r) }
    }
    modules.splice(idx, 1, a, b)
    vertical = !vertical
  }

  return {
    id: `nature-${seed}`,
    seed,
    generator: 'nature',
    params,
    aspect: 1,
    guides,
    modules,
    ratios: [{ name: 'φ', value: 1.6180339887 }],
    meta: { strategy: 'golden-section whirling subdivision' },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/grid/generators/nature.test.ts`
Expected: PASS. (Note: the depth-1 ratio test compares the two areas; since the first cut spans the full opposite axis, area ratio == width ratio == φ.)

- [ ] **Step 5: Commit**

```bash
git add src/grid/generators/nature.ts src/grid/generators/nature.test.ts
git commit -m "feat(grid): nature golden-section generator"
```

---

## Task 7: Generator registry

**Files:**
- Create: `src/grid/generators/index.ts`, `src/grid/generators/index.test.ts`

- [ ] **Step 1: Write the failing test `src/grid/generators/index.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { generate, GENERATOR_KINDS } from './index'
import { checkBounds } from '../invariants'

describe('generate registry', () => {
  it('exposes all three families', () => {
    expect(GENERATOR_KINDS).toEqual(['recursive', 'modular', 'nature'])
  })

  it('generates a valid grid for each kind from a seed alone', () => {
    for (const kind of GENERATOR_KINDS) {
      const g = generate(kind, 1234)
      expect(g.generator).toBe(kind)
      expect(checkBounds(g.modules)).toBe(true)
      expect(g.modules.length).toBeGreaterThan(1)
    }
  })

  it('is deterministic per (kind, seed)', () => {
    expect(generate('nature', 5).modules).toEqual(generate('nature', 5).modules)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/grid/generators/index.test.ts`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Write `src/grid/generators/index.ts`**

```ts
import { mulberry32, randInt } from '../prng'
import type { GeneratorKind, Grid } from '../types'
import { generateRecursive, defaultRecursiveParams } from './recursive'
import { generateModular, randomModularParams } from './modular'
import { generateNature, defaultNatureParams } from './nature'

export const GENERATOR_KINDS: GeneratorKind[] = ['recursive', 'modular', 'nature']

/** Generate a grid from a kind + seed, choosing randomized-but-valid params from the seed. */
export function generate(kind: GeneratorKind, seed: number): Grid {
  const rng = mulberry32(seed ^ 0x9e3779b9) // decorrelate param-rng from generator-rng
  switch (kind) {
    case 'recursive':
      return generateRecursive(seed, { ...defaultRecursiveParams, targetModules: randInt(rng, 5, 14) })
    case 'modular':
      return generateModular(seed, randomModularParams(rng))
    case 'nature':
      return generateNature(seed, { ...defaultNatureParams, depth: randInt(rng, 4, 8) })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/grid/generators/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/grid/generators/index.ts src/grid/generators/index.test.ts
git commit -m "feat(grid): generator registry"
```

---

## Task 8: Seed/descriptor serialization (shareable URLs)

**Files:**
- Create: `src/grid/serialize.ts`, `src/grid/serialize.test.ts`

- [ ] **Step 1: Write the failing test `src/grid/serialize.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { encodeDescriptor, decodeDescriptor } from './serialize'

describe('descriptor serialization', () => {
  it('round-trips kind + seed', () => {
    const params = new URLSearchParams()
    encodeDescriptor({ kind: 'nature', seed: 4242 }, params)
    expect(params.get('g')).toBe('nature')
    expect(params.get('s')).toBe('4242')
    expect(decodeDescriptor(params)).toEqual({ kind: 'nature', seed: 4242 })
  })

  it('falls back to a default for missing/invalid input', () => {
    expect(decodeDescriptor(new URLSearchParams())).toEqual({ kind: 'recursive', seed: 1 })
    expect(decodeDescriptor(new URLSearchParams('g=bogus&s=x'))).toEqual({ kind: 'recursive', seed: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/grid/serialize.test.ts`
Expected: FAIL — cannot find module `./serialize`.

- [ ] **Step 3: Write `src/grid/serialize.ts`**

```ts
import { GENERATOR_KINDS } from './generators'
import type { GeneratorKind } from './types'

export interface Descriptor {
  kind: GeneratorKind
  seed: number
}

const DEFAULT: Descriptor = { kind: 'recursive', seed: 1 }

export function encodeDescriptor(d: Descriptor, params: URLSearchParams): void {
  params.set('g', d.kind)
  params.set('s', String(d.seed))
}

export function decodeDescriptor(params: URLSearchParams): Descriptor {
  const kind = params.get('g')
  const seed = Number(params.get('s'))
  if (!kind || !GENERATOR_KINDS.includes(kind as GeneratorKind) || !Number.isFinite(seed)) {
    return { ...DEFAULT }
  }
  return { kind: kind as GeneratorKind, seed: Math.trunc(seed) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/grid/serialize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/grid/serialize.ts src/grid/serialize.test.ts
git commit -m "feat(grid): shareable seed/descriptor serialization"
```

---

## Task 9: GridSvg renderer + dev route (see it work)

**Files:**
- Create: `src/components/GridSvg.tsx`, `src/app/routes/DevRoute.tsx`
- Modify: `src/app/App.tsx` (restore the real `/dev` route from Task 0 Step 7)

- [ ] **Step 1: Write `src/components/GridSvg.tsx`**

```tsx
import type { Grid } from '../grid/types'

interface Props {
  grid: Grid
  size?: number
  showModules?: boolean
  showGuides?: boolean
}

export function GridSvg({ grid, size = 560, showModules = true, showGuides = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1 1"
      style={{ background: 'var(--cream)', display: 'block' }}
    >
      {showModules &&
        grid.modules.map((m, i) => (
          <rect
            key={i}
            x={m.x}
            y={m.y}
            width={m.w}
            height={m.h}
            fill="none"
            stroke="var(--slate)"
            strokeWidth={0.002}
          />
        ))}
      {showGuides &&
        grid.guides.map((g, i) =>
          g.axis === 'v' ? (
            <line key={i} x1={g.pos} y1={0} x2={g.pos} y2={1} stroke="var(--steel)" strokeWidth={0.0012} />
          ) : (
            <line key={i} x1={0} y1={g.pos} x2={1} y2={g.pos} stroke="var(--steel)" strokeWidth={0.0012} />
          ),
        )}
    </svg>
  )
}
```

- [ ] **Step 2: Write `src/app/routes/DevRoute.tsx`**

```tsx
import { useState } from 'react'
import { generate, GENERATOR_KINDS } from '../../grid/generators'
import type { GeneratorKind } from '../../grid/types'
import { GridSvg } from '../../components/GridSvg'

export function DevRoute() {
  const [kind, setKind] = useState<GeneratorKind>('recursive')
  const [seed, setSeed] = useState(1)
  const grid = generate(kind, seed)

  return (
    <main style={{ padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-mono)' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Chickpea · dev</strong>
        {GENERATOR_KINDS.map((k) => (
          <label key={k}>
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {k}
          </label>
        ))}
        <button onClick={() => setSeed((s) => s + 1)}>next seed ({seed})</button>
        <button onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>random seed</button>
        <code>modules: {grid.modules.length}</code>
        <code>ratios: {grid.ratios.map((r) => `${r.name}=${r.value.toFixed(3)}`).join(', ')}</code>
      </div>
      <GridSvg grid={grid} />
    </main>
  )
}
```

- [ ] **Step 3: Restore the real router in `src/app/App.tsx`** (the Task 0 Step 7 version)

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DevRoute } from './routes/DevRoute'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dev" element={<DevRoute />} />
        <Route path="*" element={<Navigate to="/dev" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` → open `/dev`. Confirm: switching family re-renders; "next seed"/"random seed" produce different valid grids; recursive + nature visibly tile with no gaps; modular shows even columns/rows with margins. Stop the server.

- [ ] **Step 5: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all test files PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: GridSvg renderer + dev route to visualize generators"
```

---

## Self-Review

**Spec coverage (Plan 1 portion):**
- §1 Grid engine: `Grid` type ✓ (Task 2), seeded PRNG ✓ (Task 2), `modular`/`nature`/`recursive` generators ✓ (Tasks 4–6), registry ✓ (Task 7), invariants ✓ (Task 3). `blend` is deferred to a later plan (noted; not in this increment's scope).
- §1 variation/seed-in-URL: `generate(kind, seed)` ✓; serialization ✓ (Task 8). The studio "generate/iterate" UI is Plan 3.
- §6 stack (Vite/React/TS/Vitest/Motion/Zustand/router): installed ✓ (Task 0). Motion/Zustand are dependencies now; first *used* in Plans 2–3.
- §9 module breakdown: `grid/`, `components/GridSvg`, `design/` created ✓. `palette/`, `type/`, `bisection/`, `io/`, `studio/`, `hero/` are later plans.
- Mafinest vendored ✓ (Task 1); tokens exact to Figma ✓.

**Placeholder scan:** No TBD/TODO; every code step has complete code; every test step has real assertions.

**Type consistency:** `Grid`, `Guide`, `Module`, `GeneratorKind`, `*Params` defined once in `types.ts` and imported everywhere. `generate(kind, seed)` signature consistent across registry, serialize, and DevRoute. `checkBounds`/`checkTiling` names consistent. `mulberry32`/`randInt`/`pick`/`Rng` consistent.

**Deferred (tracked for later plans):** `blend` generator; module-merging in modular; phyllotaxis/Fibonacci nature sub-strategies; ratio-annotation module (`annotate.ts`). These are explicitly Plan 2+ scope, not omissions from this increment.
