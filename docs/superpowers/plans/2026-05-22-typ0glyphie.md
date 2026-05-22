# typ0glyphie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build typ0glyphie — a single-page browser typography toy that slices an uploaded image into a grid, squeeze-fills each cell with bold typography colored from per-cell palettes, and exports a PNG/SVG of the typography-only composition.

**Architecture:** React + Vite + TypeScript single-page app. Pure functions in `lib/*` (palette extraction, dyadic swatch layout, squeeze-fill typography, cursor-axis state machine) are TDD'd in isolation. UI in `app/steps/*` composes those libs with React components. Framer Motion `layout` / `layoutId` powers the single-page morphing aesthetic. PixiJS handles the mesh-warp transform step. Zustand with persist middleware manages state to localStorage + IndexedDB.

**Tech Stack:** React 18, Vite, TypeScript, Vitest, Playwright, Framer Motion (`motion`), `@pixi/react` + PixiJS, Zustand, `idb` (IndexedDB wrapper), Sligoil Micro Medium (UI font, OFL bundled).

**Spec reference:** [docs/superpowers/specs/2026-05-22-typ0glyphie-design.md](../specs/2026-05-22-typ0glyphie-design.md). When this plan and the spec disagree, the spec wins — flag the discrepancy.

**Phases at a glance:**
- **Phase 1 · Foundation** (Tasks 1–3): scaffold, design tokens, base layout
- **Phase 2 · Libraries** (Tasks 4–7): pure-function libs with TDD
- **Phase 3 · State** (Task 8): Zustand store + persistence
- **Phase 4 · UI primitives** (Tasks 9–12): the reusable visual components
- **Phase 5 · Steps** (Tasks 13–20): upload, transform, sections, compose, background, export
- **Phase 6 · Polish** (Tasks 21–25): readouts, undo, fonts upload, animation polish, visual regression

---

## Phase 1 · Foundation

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles/global.css`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `README.md`

- [ ] **Step 1.1: Init package.json**

```bash
cat > package.json <<'EOF'
{
  "name": "typ0glyphie",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:update": "playwright test --update-snapshots",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.4",
    "motion": "^11.11.0",
    "pixi.js": "^8.3.4",
    "@pixi/react": "^8.0.0-beta.20",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vitest": "^2.0.5",
    "@vitest/ui": "^2.0.5",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "@playwright/test": "^1.46.1"
  }
}
EOF
```

- [ ] **Step 1.2: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' }
  }
});
```

- [ ] **Step 1.3: Write `tsconfig.json` and `tsconfig.node.json`**

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```jsonc
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 1.4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
});
```

- [ ] **Step 1.5: Write `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 }
  }
});
```

- [ ] **Step 1.6: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>typ0glyphie</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 1.7: Write `src/main.tsx` and a minimal `App.tsx`**

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

```tsx
// src/app/App.tsx
export default function App() {
  return <div className="page">typ0glyphie</div>;
}
```

- [ ] **Step 1.8: Write `src/styles/global.css` (skeleton — tokens come in Task 2)**

```css
:root {
  color-scheme: light;
}
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: 'Sligoil Micro Medium', ui-monospace, monospace; }
.page { min-height: 100%; padding: 24px; }
```

- [ ] **Step 1.9: Write `.gitignore`**

```
node_modules
dist
.vite
.DS_Store
playwright-report
test-results
.superpowers
```

- [ ] **Step 1.10: Write `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 1.11: Write a minimal `README.md`**

```md
# typ0glyphie

Browser-based typography toy. Upload an image, slice it into a grid, squeeze-fill each cell with bold colored type, export PNG or SVG.

## Develop

```sh
npm install
npm run dev
```

## Author

Christopher Robin Fiore
```

- [ ] **Step 1.12: Install dependencies and verify build**

```bash
npm install
npm run typecheck
npm run build
```

Expected: typecheck passes, `dist/` produced without errors.

- [ ] **Step 1.13: Commit**

```bash
git add -A
git commit -m "scaffold: vite + react + ts + vitest + playwright"
```

---

### Task 2: Design tokens, Sligoil binding, hairline aesthetic

**Files:**
- Create: `src/styles/tokens.css`
- Create: `public/fonts/Sligoil-MicroMedium.otf` (copied from the user's downloads)
- Create: `src/styles/fonts.css`
- Modify: `src/styles/global.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 2.1: Copy Sligoil into `public/fonts/`**

```bash
mkdir -p public/fonts
cp "/Users/chrisfiore/Downloads/sligoil-main/fonts/otf/Sligoil-MicroMedium.otf" public/fonts/Sligoil-MicroMedium.otf
```

- [ ] **Step 2.2: Write `src/styles/fonts.css`**

```css
@font-face {
  font-family: 'Sligoil Micro Medium';
  src: url('/fonts/Sligoil-MicroMedium.otf') format('opentype');
  font-display: block;
  font-weight: 500;
  font-style: normal;
}
```

- [ ] **Step 2.3: Write `src/styles/tokens.css`**

```css
:root {
  /* Pure brutalist palette — no greys except blur dimming */
  --ink: #000;
  --paper: #fff;
  --rule: 1px;                /* hairline weight */
  --rule-dotted: 1px;
  --crop-mark-length: 14px;
  --crop-mark-inset: 14px;

  /* Spacing scale, multiples of 4 */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 32px;
  --s-7: 48px;
  --s-8: 64px;

  /* Typography — Sligoil is the voice */
  --ui-font: 'Sligoil Micro Medium', ui-monospace, monospace;
  --ui-caption-size: 11px;
  --ui-caption-letter: 0.22em;
  --ui-label-size: 10px;
  --ui-label-letter: 0.2em;
  --ui-value-size: 13px;

  /* Display font used for the big composition (input panels show values bold) */
  --display-font: 'Helvetica Neue', Helvetica, Arial, sans-serif;

  /* Animation timings */
  --t-fast: 120ms;
  --t-base: 220ms;
  --t-slow: 440ms;
  --ease: cubic-bezier(0.4, 0.0, 0.2, 1);

  /* Picker hover scale */
  --hover-scale: 1.18;
}

/* Universal brutalist guards */
button { background: var(--paper); color: var(--ink); border: var(--rule) solid var(--ink); border-radius: 0; font: inherit; padding: var(--s-2) var(--s-3); cursor: pointer; text-transform: uppercase; letter-spacing: var(--ui-caption-letter); font-size: var(--ui-caption-size); }
button:hover { background: var(--ink); color: var(--paper); }
button:disabled { opacity: 0.4; cursor: not-allowed; }
input, textarea, select { border: var(--rule) solid var(--ink); border-radius: 0; background: var(--paper); color: var(--ink); font: inherit; padding: var(--s-2); }
input:focus, textarea:focus, select:focus { outline: var(--rule) solid var(--ink); outline-offset: 2px; }
```

- [ ] **Step 2.4: Replace `src/styles/global.css`**

```css
@import './fonts.css';
@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; padding: 0; background: var(--paper); color: var(--ink); }
body {
  font-family: var(--ui-font);
  font-size: var(--ui-caption-size);
  letter-spacing: var(--ui-caption-letter);
  text-transform: uppercase;
  -webkit-font-smoothing: antialiased;
}
.page { min-height: 100%; padding: var(--s-7); position: relative; }
```

- [ ] **Step 2.5: Verify Sligoil renders**

Modify `src/app/App.tsx` to show a value:

```tsx
export default function App() {
  return (
    <div className="page">
      <p>typ0glyphie / specimen</p>
      <p>The quick brown fox jumps over the lazy dog 0123456789</p>
    </div>
  );
}
```

Run `npm run dev`, open `http://localhost:5173`. Expected: page renders in Sligoil, monospace, uppercase, with the wide letter-spacing.

- [ ] **Step 2.6: Commit**

```bash
git add -A
git commit -m "tokens: sligoil font + brutalist token system"
```

---

### Task 3: Page chrome — CropMarks, MonoLabel, base layout shell

**Files:**
- Create: `src/components/CropMarks.tsx`
- Create: `src/components/CropMarks.module.css`
- Create: `src/components/MonoLabel.tsx`
- Create: `src/components/MonoLabel.module.css`
- Create: `src/components/__tests__/CropMarks.test.tsx`
- Create: `src/components/__tests__/MonoLabel.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 3.1: Write failing test for `MonoLabel`**

```tsx
// src/components/__tests__/MonoLabel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MonoLabel } from '../MonoLabel';

describe('MonoLabel', () => {
  it('uppercases its content and renders as a span', () => {
    render(<MonoLabel>hello</MonoLabel>);
    const node = screen.getByText('HELLO');
    expect(node.tagName).toBe('SPAN');
  });

  it('accepts size variants', () => {
    const { container } = render(<MonoLabel size="value">Hi</MonoLabel>);
    expect(container.firstChild).toHaveClass('value');
  });
});
```

Run: `npm test src/components/__tests__/MonoLabel.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3.2: Implement `MonoLabel`**

```tsx
// src/components/MonoLabel.tsx
import styles from './MonoLabel.module.css';

type Size = 'caption' | 'label' | 'value';

export interface MonoLabelProps {
  children: React.ReactNode;
  size?: Size;
  as?: 'span' | 'div' | 'p';
  className?: string;
}

export function MonoLabel({ children, size = 'caption', as = 'span', className }: MonoLabelProps) {
  const Tag = as;
  const text = typeof children === 'string' ? children.toUpperCase() : children;
  return <Tag className={`${styles.root} ${styles[size]} ${className ?? ''}`}>{text}</Tag>;
}
```

```css
/* src/components/MonoLabel.module.css */
.root { font-family: var(--ui-font); display: inline-block; }
.caption { font-size: var(--ui-caption-size); letter-spacing: var(--ui-caption-letter); }
.label   { font-size: var(--ui-label-size);   letter-spacing: var(--ui-label-letter); opacity: 0.75; }
.value   { font-size: var(--ui-value-size);   letter-spacing: 0.08em; }
```

Run the test again. Expected: PASS.

- [ ] **Step 3.3: Write failing test for `CropMarks`**

```tsx
// src/components/__tests__/CropMarks.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CropMarks } from '../CropMarks';

describe('CropMarks', () => {
  it('renders 4 corner marks (each = 2 lines, total 8 lines)', () => {
    const { container } = render(<CropMarks />);
    const lines = container.querySelectorAll('span[data-tick]');
    expect(lines.length).toBe(8);
  });
});
```

Run: FAIL.

- [ ] **Step 3.4: Implement `CropMarks`**

```tsx
// src/components/CropMarks.tsx
import styles from './CropMarks.module.css';

export function CropMarks() {
  // Each corner: two ticks (one horizontal, one vertical) inset from the page edge.
  return (
    <div className={styles.root} aria-hidden>
      {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
        <div key={corner} className={`${styles.corner} ${styles[corner]}`}>
          <span data-tick="h" className={styles.h} />
          <span data-tick="v" className={styles.v} />
        </div>
      ))}
    </div>
  );
}
```

```css
/* src/components/CropMarks.module.css */
.root { position: absolute; inset: 0; pointer-events: none; }
.corner { position: absolute; width: var(--crop-mark-length); height: var(--crop-mark-length); }
.tl { top: var(--crop-mark-inset); left: var(--crop-mark-inset); }
.tr { top: var(--crop-mark-inset); right: var(--crop-mark-inset); }
.bl { bottom: var(--crop-mark-inset); left: var(--crop-mark-inset); }
.br { bottom: var(--crop-mark-inset); right: var(--crop-mark-inset); }
.h { position: absolute; top: 50%; left: 0; right: 0; height: var(--rule); background: var(--ink); }
.v { position: absolute; left: 50%; top: 0; bottom: 0; width: var(--rule); background: var(--ink); }
```

Run test. Expected: PASS.

- [ ] **Step 3.5: Wire CropMarks into App**

```tsx
// src/app/App.tsx
import { CropMarks } from '@/components/CropMarks';
import { MonoLabel } from '@/components/MonoLabel';

export default function App() {
  return (
    <div className="page">
      <CropMarks />
      <MonoLabel>typ0glyphie · v0.1 · specimen</MonoLabel>
    </div>
  );
}
```

Run `npm run dev`. Expected: 4 hairline crop marks in the corners; small mono caption top-left.

- [ ] **Step 3.6: Commit**

```bash
git add -A
git commit -m "components: CropMarks + MonoLabel press-sheet primitives"
```

---

## Phase 2 · Libraries (pure functions, TDD)

### Task 4: `lib/palette.ts` — k-means color extraction

**Files:**
- Create: `src/lib/palette.ts`
- Create: `src/lib/__tests__/palette.test.ts`

- [ ] **Step 4.1: Write failing test**

```ts
// src/lib/__tests__/palette.test.ts
import { describe, it, expect } from 'vitest';
import { extractPalette, type RGB } from '../palette';

function makePixels(colors: RGB[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((c, i) => {
    out[i * 4 + 0] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = 255;
  });
  return out;
}

describe('extractPalette', () => {
  it('extracts k=2 clusters from a black-and-white pixel set', () => {
    const pixels = makePixels([
      [0, 0, 0], [10, 10, 10], [5, 5, 5],
      [250, 250, 250], [240, 240, 240], [255, 255, 255]
    ]);
    const palette = extractPalette(pixels, { k: 2, seed: 1 });
    expect(palette.length).toBe(2);
    const sorted = [...palette].sort((a, b) => a.rgb[0] - b.rgb[0]);
    expect(sorted[0].rgb[0]).toBeLessThan(50);
    expect(sorted[1].rgb[0]).toBeGreaterThan(200);
    const totalWeight = palette.reduce((s, p) => s + p.weight, 0);
    expect(totalWeight).toBeCloseTo(6, 5);
  });

  it('is deterministic given a seed', () => {
    const pixels = makePixels([
      [100, 50, 50], [200, 80, 60], [80, 200, 100], [50, 70, 230],
      [90, 200, 90], [100, 60, 40], [220, 70, 50], [60, 90, 240]
    ]);
    const a = extractPalette(pixels, { k: 3, seed: 42 });
    const b = extractPalette(pixels, { k: 3, seed: 42 });
    expect(a).toEqual(b);
  });

  it('respects k as upper bound (clusters with 0 pixels are dropped)', () => {
    const pixels = makePixels([[10, 10, 10], [20, 20, 20], [30, 30, 30]]);
    const palette = extractPalette(pixels, { k: 8, seed: 1 });
    expect(palette.length).toBeLessThanOrEqual(3);
  });

  it('skips transparent pixels', () => {
    const data = new Uint8ClampedArray(8);
    data[0] = 0; data[1] = 0; data[2] = 0; data[3] = 0;   // transparent black, ignored
    data[4] = 255; data[5] = 255; data[6] = 255; data[7] = 255; // opaque white
    const palette = extractPalette(data, { k: 1, seed: 1 });
    expect(palette).toHaveLength(1);
    expect(palette[0].rgb).toEqual([255, 255, 255]);
  });
});
```

Run: `npm test src/lib/__tests__/palette.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4.2: Implement `lib/palette.ts`**

```ts
// src/lib/palette.ts
export type RGB = [number, number, number];

export interface PaletteEntry {
  rgb: RGB;
  weight: number;          // pixel count assigned to this cluster
}

export interface ExtractOptions {
  k: number;               // upper bound on cluster count
  seed?: number;           // for deterministic seeding (default 1)
  maxIterations?: number;  // default 24
  sampleStride?: number;   // sample every Nth pixel for speed (default 1)
}

// Mulberry32 — small deterministic PRNG so seeded runs are reproducible.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dist2(a: RGB, b: RGB): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function extractPalette(
  pixels: Uint8ClampedArray,
  { k, seed = 1, maxIterations = 24, sampleStride = 1 }: ExtractOptions
): PaletteEntry[] {
  // Collect opaque samples
  const samples: RGB[] = [];
  for (let i = 0; i < pixels.length; i += 4 * sampleStride) {
    const a = pixels[i + 3];
    if (a < 128) continue;
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  if (samples.length === 0) return [];
  if (samples.length <= k) {
    // Each sample is its own cluster (unique colors only)
    const seen = new Map<string, PaletteEntry>();
    for (const s of samples) {
      const key = `${s[0]},${s[1]},${s[2]}`;
      const existing = seen.get(key);
      if (existing) existing.weight += 1;
      else seen.set(key, { rgb: s, weight: 1 });
    }
    return [...seen.values()];
  }

  const rand = mulberry32(seed);

  // k-means++ seeding
  const centroids: RGB[] = [samples[Math.floor(rand() * samples.length)]];
  while (centroids.length < k) {
    let totalD2 = 0;
    const d2s = samples.map(s => {
      let min = Infinity;
      for (const c of centroids) {
        const d = dist2(s, c);
        if (d < min) min = d;
      }
      totalD2 += min;
      return min;
    });
    if (totalD2 === 0) break;
    let r = rand() * totalD2;
    let chosen = 0;
    for (let i = 0; i < d2s.length; i++) {
      r -= d2s[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push(samples[chosen]);
  }

  // Lloyd iterations
  const assignments = new Int32Array(samples.length);
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    for (let i = 0; i < samples.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(samples[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed && iter > 0) break;

    const sums = centroids.map(() => [0, 0, 0, 0] as [number, number, number, number]);
    for (let i = 0; i < samples.length; i++) {
      const a = assignments[i];
      sums[a][0] += samples[i][0];
      sums[a][1] += samples[i][1];
      sums[a][2] += samples[i][2];
      sums[a][3] += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      const n = sums[c][3];
      if (n > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / n),
          Math.round(sums[c][1] / n),
          Math.round(sums[c][2] / n)
        ];
      }
    }
  }

  // Final weights
  const weights = new Array(centroids.length).fill(0);
  for (let i = 0; i < samples.length; i++) weights[assignments[i]]++;

  // Drop empties; sort by weight descending; ensure stable order with tiebreak by rgb sum
  return centroids
    .map((rgb, i) => ({ rgb, weight: weights[i] }))
    .filter(p => p.weight > 0)
    .sort((a, b) => b.weight - a.weight || (a.rgb[0] + a.rgb[1] + a.rgb[2]) - (b.rgb[0] + b.rgb[1] + b.rgb[2]));
}

export function averageColor(pixels: Uint8ClampedArray): RGB | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n++;
  }
  if (n === 0) return null;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
```

Run test. Expected: PASS.

- [ ] **Step 4.3: Commit**

```bash
git add -A
git commit -m "lib/palette: k-means color extraction with seedable PRNG"
```

---

### Task 5: `lib/dyadic-layout.ts` — dyadic swatch algorithm

**Files:**
- Create: `src/lib/dyadic-layout.ts`
- Create: `src/lib/__tests__/dyadic-layout.test.ts`

- [ ] **Step 5.1: Write failing test**

```ts
// src/lib/__tests__/dyadic-layout.test.ts
import { describe, it, expect } from 'vitest';
import { dyadicLayout, type ColorWeight } from '../dyadic-layout';

const colors = (weights: number[]): ColorWeight[] =>
  weights.map((w, i) => ({ rgb: [i * 10, 0, 0], weight: w }));

describe('dyadicLayout', () => {
  it('tiles the unit square exactly (areas sum to 1)', () => {
    const out = dyadicLayout(colors([100, 50, 25, 12, 6, 3]));
    const area = out.reduce((s, c) => s + c.w * c.h, 0);
    expect(area).toBeCloseTo(1, 6);
  });

  it('emits only squares (w === h for every cell)', () => {
    const out = dyadicLayout(colors([100, 60, 30, 15, 7, 3, 1]));
    for (const c of out) {
      expect(c.w).toBeCloseTo(c.h, 6);
    }
  });

  it('dominant color anchors top-left (x=0, y=0)', () => {
    const out = dyadicLayout(colors([100, 5, 5, 5]));
    const dominant = out.find(c => c.rgb[0] === 0);
    expect(dominant?.x).toBe(0);
    expect(dominant?.y).toBe(0);
  });

  it('no two cells overlap', () => {
    const out = dyadicLayout(colors([80, 40, 20, 10, 5, 3, 2, 1]));
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        const overlap = !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
        expect(overlap).toBe(false);
      }
    }
  });

  it('clamps total visible swatches to MAX_CELLS (85)', () => {
    const many = colors(new Array(200).fill(1));
    const out = dyadicLayout(many);
    expect(out.length).toBeLessThanOrEqual(85);
  });

  it('handles a single color by filling the unit square', () => {
    const out = dyadicLayout(colors([100]));
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(0);
    expect(out[0].y).toBe(0);
    expect(out[0].w).toBe(1);
    expect(out[0].h).toBe(1);
  });

  it('every cell has size >= MIN_SIDE (1/16)', () => {
    const out = dyadicLayout(colors([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]));
    for (const c of out) {
      expect(c.w).toBeGreaterThanOrEqual(1 / 16 - 1e-9);
    }
  });
});
```

Run: FAIL.

- [ ] **Step 5.2: Implement `lib/dyadic-layout.ts`**

```ts
// src/lib/dyadic-layout.ts
export interface ColorWeight {
  rgb: [number, number, number];
  weight: number;
}

export interface PlacedCell {
  rgb: [number, number, number];
  x: number; y: number;
  w: number; h: number;
}

const MAX_CELLS = 85;
// The size tiers, expressed as side-fractions of the unit square.
// Each tier is half the side (quarter the area) of the previous one.
const TIERS = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 16] as const;
const AREAS = TIERS.map(s => s * s);

interface FreeSquare { x: number; y: number; side: number; }

function pickTier(weightFraction: number): number {
  // Return the index in TIERS whose area is the closest power-of-4 fraction
  // greater than or equal to weightFraction, but capped at the floor tier.
  for (let i = 0; i < AREAS.length - 1; i++) {
    if (weightFraction >= (AREAS[i] + AREAS[i + 1]) / 2) return i;
  }
  return AREAS.length - 1;
}

export function dyadicLayout(input: ColorWeight[]): PlacedCell[] {
  if (input.length === 0) return [];

  // Sort by weight descending; tiebreak by rgb-sum for determinism.
  const colors = [...input].sort(
    (a, b) => b.weight - a.weight || (a.rgb[0] + a.rgb[1] + a.rgb[2]) - (b.rgb[0] + b.rgb[1] + b.rgb[2])
  ).slice(0, MAX_CELLS);

  const total = colors.reduce((s, c) => s + c.weight, 0);
  if (total === 0) return [];

  // Assign each color a tier (index into TIERS) based on its weight fraction.
  const tiers = colors.map(c => pickTier(c.weight / total));

  // Free squares stack — largest first by side.
  const free: FreeSquare[] = [{ x: 0, y: 0, side: 1 }];
  const placed: PlacedCell[] = [];

  const popLargest = (minSide: number): FreeSquare | null => {
    // Find largest free square with side >= minSide; remove and return.
    let bestIdx = -1, bestSide = -1;
    for (let i = 0; i < free.length; i++) {
      if (free[i].side >= minSide - 1e-9 && free[i].side > bestSide) {
        bestSide = free[i].side; bestIdx = i;
      }
    }
    if (bestIdx === -1) return null;
    return free.splice(bestIdx, 1)[0];
  };

  for (let i = 0; i < colors.length; i++) {
    const side = TIERS[tiers[i]];
    let target = popLargest(side);
    if (!target) {
      // No free square at this tier or larger — try popping a larger square and subdividing.
      // Look for any free square; if it exists, subdivide it down.
      target = popLargest(0);
      if (!target) break;
    }
    // Subdivide until target.side equals side
    while (target.side > side + 1e-9) {
      const half = target.side / 2;
      // Place ourselves in the top-left quadrant
      const tl: FreeSquare = { x: target.x,        y: target.y,        side: half };
      const tr: FreeSquare = { x: target.x + half, y: target.y,        side: half };
      const bl: FreeSquare = { x: target.x,        y: target.y + half, side: half };
      const br: FreeSquare = { x: target.x + half, y: target.y + half, side: half };
      free.push(tr, bl, br);
      target = tl;
    }
    placed.push({ rgb: colors[i].rgb, x: target.x, y: target.y, w: target.side, h: target.side });
  }

  // Fill remaining free squares with cloned lowest-weight colors.
  // The remaining free squares may be at any tier; subdivide them to MIN_SIDE.
  const minSide = TIERS[TIERS.length - 1];
  while (free.length > 0) {
    const sq = free.pop()!;
    if (sq.side > minSide + 1e-9) {
      const half = sq.side / 2;
      free.push(
        { x: sq.x, y: sq.y, side: half },
        { x: sq.x + half, y: sq.y, side: half },
        { x: sq.x, y: sq.y + half, side: half },
        { x: sq.x + half, y: sq.y + half, side: half }
      );
      continue;
    }
    if (placed.length >= MAX_CELLS) break;
    const cloneSrc = colors[colors.length - 1] ?? colors[0];
    placed.push({ rgb: cloneSrc.rgb, x: sq.x, y: sq.y, w: sq.side, h: sq.side });
  }

  return placed;
}
```

Run test. Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add -A
git commit -m "lib/dyadic-layout: square-tiling palette swatch generator"
```

---

### Task 6: `lib/typography-fit.ts` — squeeze-fill algorithm

**Files:**
- Create: `src/lib/typography-fit.ts`
- Create: `src/lib/__tests__/typography-fit.test.ts`

- [ ] **Step 6.1: Write failing test**

```ts
// src/lib/__tests__/typography-fit.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computeFit, type Measurer } from '../typography-fit';

// Deterministic mock measurer: width = 10px per char at ref size, height = 100px ref line height.
const fakeMeasurer: Measurer = {
  refSize: 100,
  measureLineWidth: (line: string) => line.length * 10,
  refLineHeight: 100
};

describe('computeFit', () => {
  it('fills a 200×100 cell with a 4-character single line', () => {
    const fit = computeFit({
      cellW: 200, cellH: 100,
      text: 'ABCD',
      innerPad: 0, borderPad: 0,
      measurer: fakeMeasurer
    });
    expect(fit.lines).toHaveLength(1);
    // ref width = 4 chars * 10 = 40, ref height = 100
    // globalScaleX = 200 / 40 = 5
    // globalScaleY = 100 / (1 * 100) = 1
    expect(fit.lines[0].scaleX).toBeCloseTo(5, 6);
    expect(fit.lines[0].scaleY).toBeCloseTo(1, 6);
  });

  it('normalizes multi-line widths so all lines reach the widest', () => {
    const fit = computeFit({
      cellW: 200, cellH: 200,
      text: 'ABCD\nABCDEFGH',  // ref widths 40 and 80; widest = 80
      innerPad: 0, borderPad: 0,
      measurer: fakeMeasurer
    });
    expect(fit.lines).toHaveLength(2);
    // globalScaleX = 200 / 80 = 2.5
    // line 0 per-line scaleX = 80 / 40 = 2; combined = 2.5 * 2 = 5
    // line 1 per-line scaleX = 80 / 80 = 1; combined = 2.5
    expect(fit.lines[0].scaleX).toBeCloseTo(5, 6);
    expect(fit.lines[1].scaleX).toBeCloseTo(2.5, 6);
    // globalScaleY = 200 / (2 * 100) = 1
    expect(fit.lines[0].scaleY).toBeCloseTo(1, 6);
  });

  it('honors padding by shrinking the fill rect', () => {
    const fit = computeFit({
      cellW: 200, cellH: 100,
      text: 'ABCD',
      innerPad: 0.1, borderPad: 0,   // fill rect = 200*(1-0.2) = 160 wide, 100*0.8 = 80 tall
      measurer: fakeMeasurer
    });
    expect(fit.fillRect.w).toBeCloseTo(160, 6);
    expect(fit.fillRect.h).toBeCloseTo(80, 6);
    // globalScaleX = 160 / 40 = 4
    expect(fit.lines[0].scaleX).toBeCloseTo(4, 6);
  });

  it('handles empty text by returning lines=[] and isEmpty=true', () => {
    const fit = computeFit({
      cellW: 100, cellH: 100,
      text: '',
      innerPad: 0, borderPad: 0,
      measurer: fakeMeasurer
    });
    expect(fit.isEmpty).toBe(true);
    expect(fit.lines).toHaveLength(0);
  });

  it('handles a single-char line', () => {
    const fit = computeFit({
      cellW: 100, cellH: 100,
      text: 'A',
      innerPad: 0, borderPad: 0,
      measurer: fakeMeasurer
    });
    expect(fit.lines).toHaveLength(1);
    expect(fit.lines[0].scaleX).toBeCloseTo(10, 6); // 100 / (1*10)
    expect(fit.lines[0].scaleY).toBeCloseTo(1, 6);  // 100 / (1*100)
  });
});
```

Run: FAIL.

- [ ] **Step 6.2: Implement `lib/typography-fit.ts`**

```ts
// src/lib/typography-fit.ts

export interface Measurer {
  refSize: number;                                 // reference font-size (e.g., 100)
  refLineHeight: number;                           // intrinsic line-height at refSize
  measureLineWidth: (line: string) => number;      // width at refSize
}

export interface FitInput {
  cellW: number;
  cellH: number;
  text: string;
  innerPad: number;       // 0..1 fraction of cell, per side
  borderPad: number;      // 0..1 fraction of cell, per side
  measurer: Measurer;
}

export interface FitLine {
  text: string;
  scaleX: number;
  scaleY: number;
}

export interface FitResult {
  isEmpty: boolean;
  fillRect: { w: number; h: number };
  refSize: number;
  refLineHeight: number;
  lines: FitLine[];
}

export function computeFit({ cellW, cellH, text, innerPad, borderPad, measurer }: FitInput): FitResult {
  const padTotal = innerPad + borderPad;
  const fillRect = {
    w: cellW * (1 - 2 * padTotal),
    h: cellH * (1 - 2 * padTotal)
  };

  if (text.length === 0) {
    return { isEmpty: true, fillRect, refSize: measurer.refSize, refLineHeight: measurer.refLineHeight, lines: [] };
  }

  const splitLines = text.split('\n');
  const widths = splitLines.map(l => Math.max(measurer.measureLineWidth(l), 1e-6));
  const widest = Math.max(...widths);
  const N = splitLines.length;

  const globalScaleX = fillRect.w / widest;
  const globalScaleY = fillRect.h / (N * measurer.refLineHeight);

  const lines: FitLine[] = splitLines.map((line, i) => {
    const perLineScaleX = widest / widths[i];
    return {
      text: line,
      scaleX: globalScaleX * perLineScaleX,
      scaleY: globalScaleY
    };
  });

  return { isEmpty: false, fillRect, refSize: measurer.refSize, refLineHeight: measurer.refLineHeight, lines };
}
```

Run test. Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add -A
git commit -m "lib/typography-fit: per-line squeeze-fill scale computation"
```

---

### Task 7: `lib/cursor-axis-detector.ts` — entry-direction state machine

**Files:**
- Create: `src/lib/cursor-axis-detector.ts`
- Create: `src/lib/__tests__/cursor-axis-detector.test.ts`

- [ ] **Step 7.1: Write failing test**

```ts
// src/lib/__tests__/cursor-axis-detector.test.ts
import { describe, it, expect } from 'vitest';
import { CursorAxisDetector } from '../cursor-axis-detector';

const rect = { left: 100, top: 100, right: 300, bottom: 300 }; // 200x200

describe('CursorAxisDetector', () => {
  it('starts with axis=null when outside', () => {
    const d = new CursorAxisDetector();
    expect(d.update({ x: 0, y: 0 }, rect).axis).toBeNull();
  });

  it('detects vertical axis when entering through the top', () => {
    const d = new CursorAxisDetector();
    d.update({ x: 200, y: 50 }, rect);           // outside, above
    const r = d.update({ x: 200, y: 150 }, rect); // crossed top edge
    expect(r.axis).toBe('vertical');
    expect(r.inside).toBe(true);
  });

  it('detects horizontal axis when entering through the left', () => {
    const d = new CursorAxisDetector();
    d.update({ x: 50, y: 200 }, rect);            // outside, left
    const r = d.update({ x: 150, y: 200 }, rect); // crossed left edge
    expect(r.axis).toBe('horizontal');
  });

  it('locks axis while cursor stays inside', () => {
    const d = new CursorAxisDetector();
    d.update({ x: 200, y: 50 }, rect);
    d.update({ x: 200, y: 150 }, rect);           // enter top → vertical
    const r = d.update({ x: 290, y: 290 }, rect); // moved near right/bottom but still inside
    expect(r.axis).toBe('vertical');
  });

  it('clears axis on exit; next entry redetects', () => {
    const d = new CursorAxisDetector();
    d.update({ x: 200, y: 50 }, rect);            // outside top
    d.update({ x: 200, y: 150 }, rect);           // inside, vertical
    d.update({ x: 200, y: 50 }, rect);            // exit via top
    d.update({ x: 50, y: 200 }, rect);            // outside left
    const r = d.update({ x: 150, y: 200 }, rect); // re-enter via left → horizontal
    expect(r.axis).toBe('horizontal');
  });

  it('corner-tie: chooses edge with larger crossing displacement', () => {
    const d = new CursorAxisDetector();
    // Move from (50, 50) — outside top-left corner — to (150, 200): crossed both top and left.
    // dx = +100, dy = +150 → dy is bigger crossing → entered via top → vertical.
    d.update({ x: 50, y: 50 }, rect);
    const r = d.update({ x: 150, y: 200 }, rect);
    expect(r.axis).toBe('vertical');
  });

  it('reports inside=false when truly outside', () => {
    const d = new CursorAxisDetector();
    const r = d.update({ x: 500, y: 500 }, rect);
    expect(r.inside).toBe(false);
    expect(r.axis).toBeNull();
  });
});
```

Run: FAIL.

- [ ] **Step 7.2: Implement `lib/cursor-axis-detector.ts`**

```ts
// src/lib/cursor-axis-detector.ts
export type Axis = 'vertical' | 'horizontal';

export interface Rect { left: number; top: number; right: number; bottom: number; }
export interface Point { x: number; y: number; }
export interface CursorState { inside: boolean; axis: Axis | null; }

function isInside(p: Point, r: Rect): boolean {
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

export class CursorAxisDetector {
  private lastPoint: Point | null = null;
  private lastInside = false;
  private axis: Axis | null = null;

  update(p: Point, rect: Rect): CursorState {
    const inside = isInside(p, rect);

    if (!this.lastPoint) {
      this.lastPoint = p;
      this.lastInside = inside;
      // If we start already inside, we don't know how we entered — pick vertical by default.
      this.axis = inside ? 'vertical' : null;
      return { inside, axis: this.axis };
    }

    const wasInside = this.lastInside;

    if (inside && !wasInside) {
      // Crossing event — determine which edges were crossed and pick the dominant.
      const prev = this.lastPoint;
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;

      const crossedTop    = prev.y < rect.top    && p.y >= rect.top;
      const crossedBottom = prev.y > rect.bottom && p.y <= rect.bottom;
      const crossedLeft   = prev.x < rect.left   && p.x >= rect.left;
      const crossedRight  = prev.x > rect.right  && p.x <= rect.right;

      const verticalSide   = crossedTop || crossedBottom;
      const horizontalSide = crossedLeft || crossedRight;

      if (verticalSide && !horizontalSide) {
        this.axis = 'vertical';
      } else if (horizontalSide && !verticalSide) {
        this.axis = 'horizontal';
      } else if (verticalSide && horizontalSide) {
        // Corner tie — pick whichever axis had the larger crossing displacement.
        this.axis = Math.abs(dy) >= Math.abs(dx) ? 'vertical' : 'horizontal';
      } else {
        // No edge crossing detected but inside — fallback.
        this.axis = 'vertical';
      }
    } else if (!inside && wasInside) {
      // Exited
      this.axis = null;
    } else if (!inside) {
      this.axis = null;
    }
    // else: stayed inside — keep axis lock.

    this.lastPoint = p;
    this.lastInside = inside;
    return { inside, axis: this.axis };
  }

  reset() {
    this.lastPoint = null;
    this.lastInside = false;
    this.axis = null;
  }
}
```

Run test. Expected: PASS.

- [ ] **Step 7.3: Commit**

```bash
git add -A
git commit -m "lib/cursor-axis-detector: entry-direction state machine"
```

---

## Phase 3 · State

### Task 8: Zustand store with persistence

**Files:**
- Create: `src/state/types.ts`
- Create: `src/state/store.ts`
- Create: `src/state/__tests__/store.test.ts`
- Create: `src/lib/idb.ts`

- [ ] **Step 8.1: Write `state/types.ts`**

```ts
// src/state/types.ts
import type { RGB } from '@/lib/palette';

export type Step = 'upload' | 'transform' | 'sections' | 'compose' | 'background' | 'export';

export interface TransformParams {
  scale: number;       // 1.0 default
  rotation: number;    // degrees, 0..360
  flipH: boolean;
  flipV: boolean;
  // Perspective: 4 corners in normalized (0..1) coordinates against the original image.
  perspective: null | { corners: [Point, Point, Point, Point] };
  // Mesh warp: NxM control points, normalized.
  mesh: null | { cols: number; rows: number; points: Point[] };
}

export interface Point { x: number; y: number; }

export interface SectionLines {
  v: number[];   // normalized x positions 0..1, sorted ascending
  h: number[];   // normalized y positions 0..1, sorted ascending
}

export interface Cell {
  id: string;             // stable id derived from (col,row) in the sorted line arrays
  col: number;
  row: number;
  // Bounds normalized 0..1 against the working bitmap
  x: number; y: number; w: number; h: number;
  text: string;
  fontFamily: string;
  textColor: RGB | null;
  k: number;              // k-means palette size
  innerPad: number;
  borderPad: number;
  showBorder: boolean;
}

export interface ProjectState {
  version: 1;
  step: Step;
  // Source asset
  sourceImageId: string | null;  // pointer into IDB
  // Transform
  transform: TransformParams;
  workingBitmapId: string | null; // post-transform raster, in IDB
  // Sections
  lines: SectionLines;
  cells: Record<string, Cell>;    // keyed by Cell.id
  // Background
  background: RGB | null;          // null = use global average
  // Export prefs
  exportScale: 1 | 2 | 'custom';
  exportCustom: { w: number; h: number } | null;
}

export interface UploadedFont {
  family: string;
  fileBlobId: string;     // pointer into IDB
}

export interface FontsState {
  uploaded: UploadedFont[];
}
```

- [ ] **Step 8.2: Write `lib/idb.ts` — IndexedDB wrapper**

```ts
// src/lib/idb.ts
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'typ0glyphie';
const DB_VERSION = 1;
const STORE_BLOBS = 'blobs';

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE_BLOBS)) d.createObjectStore(STORE_BLOBS);
      }
    });
  }
  return dbPromise;
}

export async function putBlob(key: string, blob: Blob) {
  const d = await db();
  await d.put(STORE_BLOBS, blob, key);
}
export async function getBlob(key: string): Promise<Blob | null> {
  const d = await db();
  return (await d.get(STORE_BLOBS, key)) ?? null;
}
export async function deleteBlob(key: string) {
  const d = await db();
  await d.delete(STORE_BLOBS, key);
}
export function newBlobId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
```

- [ ] **Step 8.3: Write `state/store.ts`**

```ts
// src/state/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Cell, FontsState, ProjectState, SectionLines, Step, TransformParams } from './types';

const initialTransform: TransformParams = {
  scale: 1, rotation: 0, flipH: false, flipV: false, perspective: null, mesh: null
};

const initialProject: ProjectState = {
  version: 1,
  step: 'upload',
  sourceImageId: null,
  transform: initialTransform,
  workingBitmapId: null,
  lines: { v: [], h: [] },
  cells: {},
  background: null,
  exportScale: 1,
  exportCustom: null
};

const initialFonts: FontsState = { uploaded: [] };

export interface Store extends ProjectState {
  fonts: FontsState;

  setStep: (s: Step) => void;
  setSourceImageId: (id: string | null) => void;
  setTransform: (patch: Partial<TransformParams>) => void;
  resetTransform: () => void;
  setWorkingBitmapId: (id: string | null) => void;

  setLines: (lines: SectionLines) => void;
  upsertCell: (cell: Cell) => void;
  removeCell: (id: string) => void;
  replaceCells: (cells: Record<string, Cell>) => void;
  setBackground: (rgb: ProjectState['background']) => void;

  setExportScale: (s: ProjectState['exportScale']) => void;
  setExportCustom: (c: ProjectState['exportCustom']) => void;

  addUploadedFont: (family: string, fileBlobId: string) => void;
  removeUploadedFont: (family: string) => void;

  resetProject: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...initialProject,
      fonts: initialFonts,

      setStep: (step) => set({ step }),
      setSourceImageId: (sourceImageId) => set({ sourceImageId }),
      setTransform: (patch) => set((s) => ({ transform: { ...s.transform, ...patch } })),
      resetTransform: () => set({ transform: initialTransform }),
      setWorkingBitmapId: (workingBitmapId) => set({ workingBitmapId }),

      setLines: (lines) => set({ lines }),
      upsertCell: (cell) => set((s) => ({ cells: { ...s.cells, [cell.id]: cell } })),
      removeCell: (id) => set((s) => {
        const { [id]: _, ...rest } = s.cells;
        return { cells: rest };
      }),
      replaceCells: (cells) => set({ cells }),
      setBackground: (background) => set({ background }),

      setExportScale: (exportScale) => set({ exportScale }),
      setExportCustom: (exportCustom) => set({ exportCustom }),

      addUploadedFont: (family, fileBlobId) =>
        set((s) => ({ fonts: { uploaded: [...s.fonts.uploaded.filter(f => f.family !== family), { family, fileBlobId }] } })),
      removeUploadedFont: (family) =>
        set((s) => ({ fonts: { uploaded: s.fonts.uploaded.filter(f => f.family !== family) } })),

      resetProject: () => set({ ...initialProject })
    }),
    {
      name: 'typ0glyphie-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { fonts, ...rest } = s;
        // Persist project + fonts metadata; blobs live in IDB.
        return { ...rest, fonts } as any;
      }
    }
  )
);
```

- [ ] **Step 8.4: Write `state/__tests__/store.test.ts`**

```ts
// src/state/__tests__/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

describe('store', () => {
  beforeEach(() => {
    useStore.getState().resetProject();
  });

  it('starts at upload step', () => {
    expect(useStore.getState().step).toBe('upload');
  });

  it('setStep transitions', () => {
    useStore.getState().setStep('sections');
    expect(useStore.getState().step).toBe('sections');
  });

  it('upsertCell adds and replaces by id', () => {
    const baseCell = {
      id: '0_0', col: 0, row: 0,
      x: 0, y: 0, w: 1, h: 1,
      text: 'HI', fontFamily: 'Sligoil Micro Medium',
      textColor: null, k: 8, innerPad: 0, borderPad: 0, showBorder: true
    } as const;
    useStore.getState().upsertCell(baseCell as any);
    expect(useStore.getState().cells['0_0'].text).toBe('HI');
    useStore.getState().upsertCell({ ...baseCell, text: 'BYE' } as any);
    expect(useStore.getState().cells['0_0'].text).toBe('BYE');
  });

  it('setTransform patches, resetTransform restores', () => {
    useStore.getState().setTransform({ scale: 1.5, rotation: 45 });
    expect(useStore.getState().transform.scale).toBe(1.5);
    useStore.getState().resetTransform();
    expect(useStore.getState().transform.scale).toBe(1);
    expect(useStore.getState().transform.rotation).toBe(0);
  });
});
```

Run: `npm test src/state/__tests__/store.test.ts`. Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add -A
git commit -m "state: zustand store + persist + idb blob layer"
```

---

## Phase 4 · UI primitives

### Task 9: `DyadicSwatch.tsx` + `AverageBlock.tsx`

**Files:**
- Create: `src/components/DyadicSwatch.tsx`
- Create: `src/components/DyadicSwatch.module.css`
- Create: `src/components/AverageBlock.tsx`
- Create: `src/components/AverageBlock.module.css`
- Create: `src/lib/color-format.ts`
- Create: `src/lib/__tests__/color-format.test.ts`
- Create: `src/components/__tests__/DyadicSwatch.test.tsx`

- [ ] **Step 9.1: Write `lib/color-format.ts` + test**

```ts
// src/lib/__tests__/color-format.test.ts
import { describe, it, expect } from 'vitest';
import { rgbToHex, hexToRgb } from '../color-format';

describe('color-format', () => {
  it('rgbToHex pads', () => {
    expect(rgbToHex([0, 0, 0])).toBe('#000000');
    expect(rgbToHex([74, 107, 88])).toBe('#4A6B58');
  });
  it('round-trip', () => {
    expect(hexToRgb('#4A6B58')).toEqual([74, 107, 88]);
  });
});
```

```ts
// src/lib/color-format.ts
import type { RGB } from './palette';

export type { RGB };

export function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex: string): RGB {
  const s = hex.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
```

Run test. Expected: PASS.

- [ ] **Step 9.2: Write `DyadicSwatch.tsx`**

```tsx
// src/components/DyadicSwatch.tsx
import { motion, AnimatePresence } from 'motion/react';
import type { PlacedCell } from '@/lib/dyadic-layout';
import { rgbToHex } from '@/lib/color-format';
import styles from './DyadicSwatch.module.css';

export interface DyadicSwatchProps {
  cells: PlacedCell[];
  selected?: string | null;       // hex of selected cell
  onPick?: (hex: string) => void;
  onHover?: (hex: string | null) => void;
  layoutGroup: string;            // namespace for layoutId so global vs per-tile swatches don't collide
}

export function DyadicSwatch({ cells, selected, onPick, onHover, layoutGroup }: DyadicSwatchProps) {
  return (
    <div className={styles.frame}>
      <AnimatePresence initial={false}>
        {cells.map((c) => {
          const hex = rgbToHex(c.rgb);
          return (
            <motion.button
              key={`${layoutGroup}:${hex}:${c.x},${c.y}`}
              layoutId={`${layoutGroup}:${hex}`}
              className={`${styles.cell} ${selected === hex ? styles.selected : ''}`}
              style={{
                left: `${c.x * 100}%`,
                top: `${c.y * 100}%`,
                width: `${c.w * 100}%`,
                height: `${c.h * 100}%`,
                background: hex
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => onPick?.(hex)}
              onMouseEnter={() => onHover?.(hex)}
              onMouseLeave={() => onHover?.(null)}
              aria-label={`Pick ${hex}`}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

```css
/* src/components/DyadicSwatch.module.css */
.frame { position: relative; aspect-ratio: 1 / 1; width: 100%; background: var(--paper); overflow: hidden; }
.cell { position: absolute; border: 0; padding: 0; cursor: pointer; transition: transform var(--t-fast) var(--ease); }
.cell:hover { transform: scale(var(--hover-scale)); z-index: 2; outline: var(--rule) solid var(--ink); }
.cell.selected { outline: var(--rule) solid var(--ink); outline-offset: -2px; box-shadow: inset 0 0 0 2px var(--paper); }
```

- [ ] **Step 9.3: Write smoke test for DyadicSwatch**

```tsx
// src/components/__tests__/DyadicSwatch.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DyadicSwatch } from '../DyadicSwatch';

describe('DyadicSwatch', () => {
  it('renders one button per cell', () => {
    render(
      <DyadicSwatch
        layoutGroup="t"
        cells={[
          { rgb: [0, 0, 0], x: 0, y: 0, w: 0.5, h: 0.5 },
          { rgb: [255, 255, 255], x: 0.5, y: 0, w: 0.5, h: 0.5 }
        ]}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('emits hex on click', () => {
    const onPick = vi.fn();
    render(
      <DyadicSwatch
        layoutGroup="t"
        cells={[{ rgb: [74, 107, 88], x: 0, y: 0, w: 1, h: 1 }]}
        onPick={onPick}
      />
    );
    screen.getByRole('button').click();
    expect(onPick).toHaveBeenCalledWith('#4A6B58');
  });
});
```

Run. Expected: PASS.

- [ ] **Step 9.4: Write `AverageBlock.tsx`**

```tsx
// src/components/AverageBlock.tsx
import { rgbToHex } from '@/lib/color-format';
import type { RGB } from '@/lib/palette';
import { MonoLabel } from './MonoLabel';
import styles from './AverageBlock.module.css';

export interface AverageBlockProps {
  rgb: RGB;
  selected?: boolean;
  onPick?: (hex: string) => void;
  subtitle?: string;
}

export function AverageBlock({ rgb, selected, onPick, subtitle = 'Global swatch average' }: AverageBlockProps) {
  const hex = rgbToHex(rgb);
  return (
    <button
      type="button"
      className={`${styles.root} ${selected ? styles.selected : ''}`}
      style={{ background: hex }}
      onClick={() => onPick?.(hex)}
      aria-label={`Use average color ${hex}`}
    >
      <div className={styles.stamp}>
        <div className={styles.hex}>{hex}</div>
        <MonoLabel>{subtitle}</MonoLabel>
      </div>
    </button>
  );
}
```

```css
/* src/components/AverageBlock.module.css */
.root { position: relative; width: 100%; height: 100%; border: 0; padding: 0; cursor: pointer; }
.root.selected { outline: var(--rule) solid var(--ink); outline-offset: -2px; }
.stamp { position: absolute; left: var(--s-5); bottom: var(--s-5); color: var(--paper); mix-blend-mode: difference; pointer-events: none; }
.hex { font-family: var(--display-font); font-weight: 900; font-size: clamp(40px, 6vw, 84px); letter-spacing: -0.02em; line-height: 0.9; margin-bottom: var(--s-2); }
```

- [ ] **Step 9.5: Commit**

```bash
git add -A
git commit -m "components: DyadicSwatch + AverageBlock + color format"
```

---

### Task 10: `CellTextRenderer.tsx`

**Files:**
- Create: `src/components/CellTextRenderer.tsx`
- Create: `src/components/CellTextRenderer.module.css`
- Create: `src/lib/canvas-measurer.ts`
- Create: `src/components/__tests__/CellTextRenderer.test.tsx`

- [ ] **Step 10.1: Write `lib/canvas-measurer.ts`**

```ts
// src/lib/canvas-measurer.ts
import type { Measurer } from './typography-fit';

const REF_SIZE = 100;

export function createCanvasMeasurer(fontFamily: string): Measurer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${REF_SIZE}px "${fontFamily}"`;
  // Most browser fonts: ascent + descent ≈ refSize * 1.2; use ascent/descent metrics if available
  let refLineHeight = REF_SIZE * 1.2;
  const m = ctx.measureText('M');
  if ('actualBoundingBoxAscent' in m && 'actualBoundingBoxDescent' in m) {
    refLineHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (refLineHeight <= 0) refLineHeight = REF_SIZE * 1.2;
  }
  return {
    refSize: REF_SIZE,
    refLineHeight,
    measureLineWidth: (line: string) => {
      if (line.length === 0) return 0;
      ctx.font = `${REF_SIZE}px "${fontFamily}"`;
      return ctx.measureText(line).width;
    }
  };
}
```

- [ ] **Step 10.2: Write `CellTextRenderer.tsx`**

```tsx
// src/components/CellTextRenderer.tsx
import { useMemo } from 'react';
import { computeFit } from '@/lib/typography-fit';
import { createCanvasMeasurer } from '@/lib/canvas-measurer';
import { rgbToHex } from '@/lib/color-format';
import type { RGB } from '@/lib/palette';
import styles from './CellTextRenderer.module.css';

export interface CellTextRendererProps {
  cellW: number;        // in CSS px
  cellH: number;
  text: string;
  fontFamily: string;
  color: RGB | null;
  innerPad: number;
  borderPad: number;
  showBorder: boolean;
}

export function CellTextRenderer({
  cellW, cellH, text, fontFamily, color, innerPad, borderPad, showBorder
}: CellTextRendererProps) {
  const measurer = useMemo(() => createCanvasMeasurer(fontFamily), [fontFamily]);
  const fit = useMemo(
    () => computeFit({ cellW, cellH, text, innerPad, borderPad, measurer }),
    [cellW, cellH, text, innerPad, borderPad, measurer]
  );

  const fillX = (innerPad + borderPad) * cellW;
  const fillY = (innerPad + borderPad) * cellH;
  const borderX = borderPad * cellW;
  const borderY = borderPad * cellH;
  const borderW = cellW - 2 * borderX;
  const borderH = cellH - 2 * borderY;

  return (
    <div className={styles.root} style={{ width: cellW, height: cellH }}>
      {showBorder && (
        <div
          className={styles.border}
          style={{ left: borderX, top: borderY, width: borderW, height: borderH }}
        />
      )}
      {fit.isEmpty ? (
        <div className={styles.cross} style={{ left: cellW / 2 - 6, top: cellH / 2 - 6 }} aria-hidden>
          <span className={styles.crossH} />
          <span className={styles.crossV} />
        </div>
      ) : (
        <div
          className={styles.lines}
          style={{
            left: fillX,
            top: fillY,
            width: fit.fillRect.w,
            height: fit.fillRect.h,
            fontFamily,
            color: color ? rgbToHex(color) : 'var(--ink)'
          }}
        >
          {fit.lines.map((l, i) => (
            <span
              key={i}
              className={styles.line}
              style={{
                fontSize: `${fit.refSize}px`,
                lineHeight: `${fit.refLineHeight}px`,
                height: `${fit.refLineHeight}px`,
                transform: `scale(${l.scaleX}, ${l.scaleY})`,
                transformOrigin: 'left top'
              }}
            >
              {l.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

```css
/* src/components/CellTextRenderer.module.css */
.root { position: relative; overflow: hidden; }
.border { position: absolute; border: var(--rule) solid var(--ink); pointer-events: none; }
.lines { position: absolute; display: flex; flex-direction: column; }
.line { display: block; white-space: pre; font-weight: 900; }
.cross { position: absolute; width: 12px; height: 12px; }
.crossH { position: absolute; left: 0; right: 0; top: 50%; height: var(--rule); background: var(--ink); }
.crossV { position: absolute; top: 0; bottom: 0; left: 50%; width: var(--rule); background: var(--ink); }
```

- [ ] **Step 10.3: Write smoke test**

```tsx
// src/components/__tests__/CellTextRenderer.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CellTextRenderer } from '../CellTextRenderer';

describe('CellTextRenderer', () => {
  it('renders a registration cross when empty', () => {
    const { container } = render(
      <CellTextRenderer cellW={100} cellH={100} text="" fontFamily="Arial"
        color={null} innerPad={0} borderPad={0} showBorder={false} />
    );
    expect(container.querySelector('[aria-hidden]')).toBeInTheDocument();
  });

  it('renders one span per line', () => {
    render(
      <CellTextRenderer cellW={400} cellH={200} text={'HI\nMOM'} fontFamily="Arial"
        color={[0, 0, 0]} innerPad={0} borderPad={0} showBorder={false} />
    );
    expect(screen.getByText('HI')).toBeInTheDocument();
    expect(screen.getByText('MOM')).toBeInTheDocument();
  });
});
```

Run. Expected: PASS.

- [ ] **Step 10.4: Commit**

```bash
git add -A
git commit -m "components: CellTextRenderer with squeeze-fill + border + empty cross"
```

---

### Task 11: `LeafAxisIndicator.tsx`, `FontPicker.tsx`, sliders

**Files:**
- Create: `src/components/LeafAxisIndicator.tsx`
- Create: `src/components/LeafAxisIndicator.module.css`
- Create: `src/components/FontPicker.tsx`
- Create: `src/components/FontPicker.module.css`
- Create: `src/components/KSlider.tsx`
- Create: `src/components/PaddingSlider.tsx`
- Create: `src/components/Slider.module.css`
- Create: `src/components/ReadoutStrip.tsx`
- Create: `src/components/ReadoutStrip.module.css`

- [ ] **Step 11.1: `LeafAxisIndicator.tsx`**

```tsx
// src/components/LeafAxisIndicator.tsx
import { motion } from 'motion/react';
import styles from './LeafAxisIndicator.module.css';

export interface LeafAxisIndicatorProps {
  axis: 'vertical' | 'horizontal' | null;
}

export function LeafAxisIndicator({ axis }: LeafAxisIndicatorProps) {
  const rotate = axis === 'horizontal' ? 90 : 0;
  return (
    <motion.svg
      viewBox="0 0 60 60"
      className={styles.root}
      animate={{ rotate }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      aria-hidden
    >
      <line x1="30" y1="6" x2="30" y2="54" strokeWidth="3" stroke="black" />
      <line x1="30" y1="18" x2="14" y2="26" strokeWidth="2" stroke="black" />
      <line x1="30" y1="30" x2="46" y2="38" strokeWidth="2" stroke="black" />
      <line x1="30" y1="42" x2="14" y2="50" strokeWidth="2" stroke="black" />
    </motion.svg>
  );
}
```

```css
/* src/components/LeafAxisIndicator.module.css */
.root { width: 36px; height: 36px; }
```

- [ ] **Step 11.2: Curated font registry + `FontPicker.tsx`**

```ts
// src/lib/font-registry.ts
export interface CuratedFont { family: string; cssName: string; webfontUrl?: string; }

export const CURATED_FONTS: CuratedFont[] = [
  { family: 'Sligoil Micro Medium', cssName: 'Sligoil Micro Medium' },
  { family: 'Space Grotesk',        cssName: 'Space Grotesk',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap' },
  { family: 'Archivo Black',        cssName: 'Archivo Black',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap' },
  { family: 'Syne',                 cssName: 'Syne',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap' },
  { family: 'Pixelify Sans',        cssName: 'Pixelify Sans',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@700&display=swap' },
  { family: 'IBM Plex Mono',        cssName: 'IBM Plex Mono',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@700&display=swap' },
  { family: 'JetBrains Mono',       cssName: 'JetBrains Mono',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@800&display=swap' },
  { family: 'Fraunces',             cssName: 'Fraunces',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@900&display=swap' },
  { family: 'DM Serif Display',     cssName: 'DM Serif Display',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap' },
  { family: 'Bebas Neue',           cssName: 'Bebas Neue',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap' },
  { family: 'Big Shoulders Display',cssName: 'Big Shoulders Display',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&display=swap' },
  { family: 'Redaction',            cssName: 'Redaction',
    webfontUrl: 'https://fonts.googleapis.com/css2?family=Redaction&display=swap' }
];
```

```tsx
// src/components/FontPicker.tsx
import { useEffect } from 'react';
import { CURATED_FONTS } from '@/lib/font-registry';
import { useStore } from '@/state/store';
import styles from './FontPicker.module.css';

export interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const uploaded = useStore(s => s.fonts.uploaded);

  // Lazily inject Google Fonts stylesheet links for curated webfonts
  useEffect(() => {
    for (const f of CURATED_FONTS) {
      if (!f.webfontUrl) continue;
      const id = `font-link-${f.family.replace(/\s+/g, '-')}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet'; link.href = f.webfontUrl;
      document.head.appendChild(link);
    }
  }, []);

  return (
    <select className={styles.root} value={value} onChange={e => onChange(e.target.value)}>
      <optgroup label="CURATED">
        {CURATED_FONTS.map(f => (
          <option key={f.family} value={f.family} style={{ fontFamily: f.cssName }}>{f.family}</option>
        ))}
      </optgroup>
      {uploaded.length > 0 && (
        <optgroup label="YOUR FONTS">
          {uploaded.map(f => (
            <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>{f.family}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
```

```css
/* src/components/FontPicker.module.css */
.root { width: 100%; }
```

- [ ] **Step 11.3: `KSlider.tsx`, `PaddingSlider.tsx`, shared `Slider.module.css`**

```tsx
// src/components/KSlider.tsx
import { MonoLabel } from './MonoLabel';
import styles from './Slider.module.css';

export function KSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className={styles.root}>
      <MonoLabel size="label">k · colors</MonoLabel>
      <div className={styles.row}>
        <input type="range" min={2} max={64} step={1} value={value} onChange={e => onChange(+e.target.value)} />
        <MonoLabel size="value">{value}</MonoLabel>
      </div>
    </label>
  );
}
```

```tsx
// src/components/PaddingSlider.tsx
import { MonoLabel } from './MonoLabel';
import styles from './Slider.module.css';

export function PaddingSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className={styles.root}>
      <MonoLabel size="label">{label}</MonoLabel>
      <div className={styles.row}>
        <input type="range" min={0} max={0.3} step={0.01} value={value} onChange={e => onChange(+e.target.value)} />
        <MonoLabel size="value">{(value * 100).toFixed(0)}%</MonoLabel>
      </div>
    </label>
  );
}
```

```css
/* src/components/Slider.module.css */
.root { display: block; margin: var(--s-3) 0; }
.row { display: flex; align-items: center; gap: var(--s-3); margin-top: var(--s-1); }
.row input[type="range"] { flex: 1; accent-color: var(--ink); }
```

- [ ] **Step 11.4: `ReadoutStrip.tsx`**

```tsx
// src/components/ReadoutStrip.tsx
import styles from './ReadoutStrip.module.css';
import { MonoLabel } from './MonoLabel';

export function ReadoutStrip({ children, position = 'bottom' }: { children: React.ReactNode; position?: 'top' | 'bottom' }) {
  return (
    <div className={`${styles.root} ${styles[position]}`}>
      <MonoLabel>{children}</MonoLabel>
    </div>
  );
}
```

```css
/* src/components/ReadoutStrip.module.css */
.root { position: absolute; left: var(--s-5); right: var(--s-5); padding: var(--s-2) 0; border-top: var(--rule) solid var(--ink); }
.top    { top: var(--s-5); border-top: 0; border-bottom: var(--rule) solid var(--ink); }
.bottom { bottom: var(--s-5); }
```

- [ ] **Step 11.5: Commit**

```bash
git add -A
git commit -m "components: leaf axis indicator + font picker + sliders + readout strip"
```

---

### Task 12: Cell geometry helper

**Files:**
- Create: `src/lib/cells.ts`
- Create: `src/lib/__tests__/cells.test.ts`

This produces the deterministic `Cell.id` map from `SectionLines` so the cells store can stay in sync with the lines.

- [ ] **Step 12.1: Write failing test**

```ts
// src/lib/__tests__/cells.test.ts
import { describe, it, expect } from 'vitest';
import { buildCells, cellId } from '../cells';

describe('cells', () => {
  it('zero lines → 1 cell covering the whole image', () => {
    const cells = buildCells({ v: [], h: [] });
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ col: 0, row: 0, x: 0, y: 0, w: 1, h: 1, id: '0_0' });
  });

  it('2v + 1h → 3 cols × 2 rows = 6 cells', () => {
    const cells = buildCells({ v: [0.3, 0.7], h: [0.5] });
    expect(cells).toHaveLength(6);
    expect(cells.find(c => c.id === '0_0')).toMatchObject({ x: 0, y: 0, w: 0.3, h: 0.5 });
    expect(cells.find(c => c.id === '1_0')).toMatchObject({ x: 0.3, y: 0, w: 0.4, h: 0.5 });
    expect(cells.find(c => c.id === '2_1')).toMatchObject({ x: 0.7, y: 0.5, w: 0.3, h: 0.5 });
  });

  it('cellId is stable across line reorder if final sort is consistent', () => {
    expect(cellId(0, 0)).toBe('0_0');
    expect(cellId(2, 1)).toBe('2_1');
  });
});
```

Run: FAIL.

- [ ] **Step 12.2: Implement `lib/cells.ts`**

```ts
// src/lib/cells.ts
import type { SectionLines } from '@/state/types';

export function cellId(col: number, row: number) {
  return `${col}_${row}`;
}

export interface CellBounds {
  id: string;
  col: number;
  row: number;
  x: number; y: number; w: number; h: number;
}

export function buildCells({ v, h }: SectionLines): CellBounds[] {
  const xs = [0, ...[...v].sort((a, b) => a - b), 1];
  const ys = [0, ...[...h].sort((a, b) => a - b), 1];
  const cells: CellBounds[] = [];
  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      cells.push({
        id: cellId(col, row),
        col, row,
        x: xs[col],
        y: ys[row],
        w: xs[col + 1] - xs[col],
        h: ys[row + 1] - ys[row]
      });
    }
  }
  return cells;
}
```

Run test. Expected: PASS.

- [ ] **Step 12.3: Commit**

```bash
git add -A
git commit -m "lib/cells: deterministic cell bounds from section lines"
```

---

## Phase 5 · Steps

### Task 13: UploadStep

**Files:**
- Create: `src/app/steps/UploadStep.tsx`
- Create: `src/app/steps/UploadStep.module.css`
- Create: `src/lib/image-io.ts`
- Modify: `src/app/App.tsx`

- [ ] **Step 13.1: Write `lib/image-io.ts`**

```ts
// src/lib/image-io.ts
import { putBlob, getBlob, newBlobId } from './idb';

export async function storeUploadedImage(file: File): Promise<{ blobId: string; bitmap: ImageBitmap }> {
  const blobId = newBlobId('src');
  await putBlob(blobId, file);
  const bitmap = await createImageBitmap(file);
  return { blobId, bitmap };
}

export async function loadStoredImage(blobId: string): Promise<ImageBitmap | null> {
  const blob = await getBlob(blobId);
  if (!blob) return null;
  return createImageBitmap(blob);
}
```

- [ ] **Step 13.2: Implement `UploadStep.tsx`**

```tsx
// src/app/steps/UploadStep.tsx
import { useState, useRef } from 'react';
import { useStore } from '@/state/store';
import { storeUploadedImage } from '@/lib/image-io';
import { MonoLabel } from '@/components/MonoLabel';
import styles from './UploadStep.module.css';

export function UploadStep() {
  const setSourceImageId = useStore(s => s.setSourceImageId);
  const setStep = useStore(s => s.setStep);
  const resetProject = useStore(s => s.resetProject);
  const sourceImageId = useStore(s => s.sourceImageId);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const { blobId } = await storeUploadedImage(file);
    setSourceImageId(blobId);
    setStep('transform');
  }

  return (
    <div className={styles.root}>
      <div
        className={`${styles.drop} ${drag ? styles.dragging : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files[0]; if (f) handleFile(f);
        }}
        onClick={() => fileInput.current?.click()}
      >
        <MonoLabel size="value">Drop an image</MonoLabel>
        <MonoLabel>or click to choose</MonoLabel>
        <input
          ref={fileInput} type="file" accept="image/*" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {sourceImageId && (
        <button className={styles.clear} onClick={resetProject}>Clear current project</button>
      )}
    </div>
  );
}
```

```css
/* src/app/steps/UploadStep.module.css */
.root { display: flex; flex-direction: column; align-items: center; gap: var(--s-5); padding: var(--s-7) 0; }
.drop {
  border: var(--rule) solid var(--ink);
  padding: var(--s-8); min-width: 420px; min-height: 280px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--s-3); cursor: pointer;
}
.drop.dragging { background: var(--ink); color: var(--paper); }
.drop.dragging :global([class*='MonoLabel']) { color: var(--paper); }
.clear { align-self: center; }
```

- [ ] **Step 13.3: Wire UploadStep into App**

```tsx
// src/app/App.tsx
import { useStore } from '@/state/store';
import { CropMarks } from '@/components/CropMarks';
import { MonoLabel } from '@/components/MonoLabel';
import { UploadStep } from './steps/UploadStep';

export default function App() {
  const step = useStore(s => s.step);
  return (
    <div className="page">
      <CropMarks />
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <MonoLabel>typ0glyphie · step {stepIndex(step)} / 6 · {step}</MonoLabel>
        <MonoLabel>v0.1</MonoLabel>
      </header>
      {step === 'upload' && <UploadStep />}
    </div>
  );
}

function stepIndex(s: string) {
  return ['upload', 'transform', 'sections', 'compose', 'background', 'export'].indexOf(s) + 1;
}
```

- [ ] **Step 13.4: Smoke test in browser**

Run `npm run dev`. Drop an image. Expected: state advances to `transform`; localStorage shows `typ0glyphie-v1` key with `step: "transform"`.

- [ ] **Step 13.5: Commit**

```bash
git add -A
git commit -m "step/upload: drop image to IDB, advance to transform"
```

---

### Task 14: TransformStep — basic tools (scale, rotate, flip)

**Files:**
- Create: `src/app/steps/TransformStep.tsx`
- Create: `src/app/steps/TransformStep.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 14.1: Implement TransformStep without warp**

```tsx
// src/app/steps/TransformStep.tsx
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { loadStoredImage } from '@/lib/image-io';
import { putBlob, newBlobId } from '@/lib/idb';
import { MonoLabel } from '@/components/MonoLabel';
import styles from './TransformStep.module.css';

export function TransformStep() {
  const { transform, setTransform, resetTransform, sourceImageId, setStep, setWorkingBitmapId } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);

  useEffect(() => {
    if (!sourceImageId) { setStep('upload'); return; }
    loadStoredImage(sourceImageId).then(setBitmap);
  }, [sourceImageId, setStep]);

  // Render bitmap with transforms
  useEffect(() => {
    if (!bitmap || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const padding = 80;
    const maxW = canvas.parentElement!.clientWidth - padding;
    const maxH = canvas.parentElement!.clientHeight - padding;
    const aspect = bitmap.width / bitmap.height;
    let w = maxW, h = maxW / aspect;
    if (h > maxH) { h = maxH; w = maxH * aspect; }
    canvas.width = w; canvas.height = h;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    ctx.restore();
  }, [bitmap, transform]);

  async function advance() {
    // Rasterize current view to working bitmap
    if (!canvasRef.current) return;
    const blob: Blob = await new Promise(res => canvasRef.current!.toBlob(b => res(b!), 'image/png'));
    const id = newBlobId('working');
    await putBlob(id, blob);
    setWorkingBitmapId(id);
    setStep('sections');
  }

  return (
    <div className={styles.root}>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <aside className={styles.sidebar}>
        <MonoLabel size="label">Transform</MonoLabel>
        <button onClick={() => setTransform({ rotation: (transform.rotation + 90) % 360 })}>Rot 90°</button>
        <button onClick={() => setTransform({ flipH: !transform.flipH })}>Flip H</button>
        <button onClick={() => setTransform({ flipV: !transform.flipV })}>Flip V</button>
        <label>
          <MonoLabel size="label">Scale</MonoLabel>
          <input type="range" min={0.25} max={3} step={0.01} value={transform.scale}
            onChange={e => setTransform({ scale: +e.target.value })} />
          <MonoLabel size="value">{(transform.scale * 100).toFixed(0)}%</MonoLabel>
        </label>
        <label>
          <MonoLabel size="label">Rotate free</MonoLabel>
          <input type="range" min={0} max={360} step={1} value={transform.rotation}
            onChange={e => setTransform({ rotation: +e.target.value })} />
          <MonoLabel size="value">{transform.rotation.toFixed(0)}°</MonoLabel>
        </label>
        <button onClick={resetTransform}>Reset all</button>
        <div style={{ flex: 1 }} />
        <button onClick={advance}>Sections →</button>
      </aside>
    </div>
  );
}
```

```css
/* src/app/steps/TransformStep.module.css */
.root { display: grid; grid-template-columns: 1fr 220px; gap: var(--s-5); height: calc(100vh - 160px); }
.canvasWrap { position: relative; border: var(--rule) solid var(--ink); display: flex; align-items: center; justify-content: center; padding: var(--s-5); }
.canvas { display: block; }
.sidebar { display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-3); border: var(--rule) solid var(--ink); }
```

- [ ] **Step 14.2: Wire TransformStep**

```tsx
// in src/app/App.tsx — add import and switch case
import { TransformStep } from './steps/TransformStep';
// ...
{step === 'transform' && <TransformStep />}
```

- [ ] **Step 14.3: Smoke test in browser**

Upload → land on transform → adjust scale/rotation → advance to sections. State persists across refresh.

- [ ] **Step 14.4: Commit**

```bash
git add -A
git commit -m "step/transform: scale + rotation + flip + rasterize on advance"
```

---

### Task 15: TransformStep — perspective + mesh warp via PixiJS

**Files:**
- Create: `src/lib/mesh-warp.ts`
- Modify: `src/app/steps/TransformStep.tsx`
- Modify: `src/state/types.ts` (already has perspective + mesh; verify)

- [ ] **Step 15.1: Write `lib/mesh-warp.ts`**

```ts
// src/lib/mesh-warp.ts
import { Application, Texture, MeshSimple } from 'pixi.js';
import type { Point } from '@/state/types';

export function defaultMeshPoints(cols: number, rows: number): Point[] {
  const points: Point[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      points.push({ x: c / cols, y: r / rows });
    }
  }
  return points;
}

export function perspectiveCorners(): [Point, Point, Point, Point] {
  return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
}

export interface RasterPlan {
  width: number;
  height: number;
  triangles: Float32Array;     // each pair x,y = vertex in canvas pixels
  uvs: Float32Array;           // matching uv coords 0..1
  indices: Uint16Array;
}

export function buildMeshTriangles(points: Point[], cols: number, rows: number, w: number, h: number): RasterPlan {
  const triangles = new Float32Array(points.length * 2);
  const uvs = new Float32Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    triangles[i * 2 + 0] = points[i].x * w;
    triangles[i * 2 + 1] = points[i].y * h;
    const col = i % (cols + 1);
    const row = Math.floor(i / (cols + 1));
    uvs[i * 2 + 0] = col / cols;
    uvs[i * 2 + 1] = row / rows;
  }
  const indices: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tl = r * (cols + 1) + c;
      const tr = tl + 1;
      const bl = tl + (cols + 1);
      const br = bl + 1;
      indices.push(tl, tr, bl, tr, br, bl);
    }
  }
  return { width: w, height: h, triangles, uvs, indices: new Uint16Array(indices) };
}

export async function rasterizeWithPixi(
  bitmap: ImageBitmap,
  w: number, h: number,
  plan: RasterPlan
): Promise<Blob> {
  const app = new Application();
  await app.init({ width: w, height: h, backgroundAlpha: 0, antialias: true });
  const texture = Texture.from(bitmap as unknown as HTMLImageElement);
  const mesh = new MeshSimple({ texture, vertices: plan.triangles, uvs: plan.uvs, indices: plan.indices });
  app.stage.addChild(mesh);
  app.render();
  const canvas = app.canvas as HTMLCanvasElement;
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
  app.destroy(true);
  return blob;
}
```

- [ ] **Step 15.2: Integrate into TransformStep**

Add buttons `PERSPECTIVE` and `MESH 4×4 / 6×6 / 8×8`. When mesh active, render an overlay with draggable handles for each grid point. On `Sections →` (advance), if `transform.mesh` is set, call `rasterizeWithPixi(bitmap, w, h, plan)` instead of the existing canvas snapshot.

Full updated `TransformStep.tsx`:

```tsx
// src/app/steps/TransformStep.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { loadStoredImage } from '@/lib/image-io';
import { putBlob, newBlobId } from '@/lib/idb';
import { MonoLabel } from '@/components/MonoLabel';
import { ReadoutStrip } from '@/components/ReadoutStrip';
import { buildMeshTriangles, defaultMeshPoints, rasterizeWithPixi } from '@/lib/mesh-warp';
import styles from './TransformStep.module.css';

export function TransformStep() {
  const {
    transform, setTransform, resetTransform,
    sourceImageId, setStep, setWorkingBitmapId
  } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);

  useEffect(() => {
    if (!sourceImageId) { setStep('upload'); return; }
    loadStoredImage(sourceImageId).then(setBitmap);
  }, [sourceImageId, setStep]);

  const renderInfo = useMemo(() => {
    if (!bitmap || !canvasRef.current?.parentElement) return null;
    const padding = 80;
    const parent = canvasRef.current.parentElement!;
    const maxW = parent.clientWidth - padding;
    const maxH = parent.clientHeight - padding;
    const aspect = bitmap.width / bitmap.height;
    let w = maxW, h = maxW / aspect;
    if (h > maxH) { h = maxH; w = maxH * aspect; }
    return { w, h };
  }, [bitmap]);

  // Render preview (simple transforms only; mesh shown as overlay handles)
  useEffect(() => {
    if (!bitmap || !canvasRef.current || !renderInfo) return;
    const { w, h } = renderInfo;
    const canvas = canvasRef.current;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    ctx.restore();
  }, [bitmap, transform, renderInfo]);

  async function advance() {
    if (!canvasRef.current || !bitmap || !renderInfo) return;
    let blob: Blob;
    if (transform.mesh) {
      const plan = buildMeshTriangles(transform.mesh.points, transform.mesh.cols, transform.mesh.rows, renderInfo.w, renderInfo.h);
      blob = await rasterizeWithPixi(bitmap, renderInfo.w, renderInfo.h, plan);
    } else {
      blob = await new Promise<Blob>(res => canvasRef.current!.toBlob(b => res(b!), 'image/png'));
    }
    const id = newBlobId('working');
    await putBlob(id, blob);
    setWorkingBitmapId(id);
    setStep('sections');
  }

  function toggleMesh(cols: number, rows: number) {
    if (transform.mesh && transform.mesh.cols === cols && transform.mesh.rows === rows) {
      setTransform({ mesh: null });
    } else {
      setTransform({ mesh: { cols, rows, points: defaultMeshPoints(cols, rows) } });
    }
  }

  function dragMeshPoint(idx: number, p: { x: number; y: number }) {
    if (!transform.mesh || !renderInfo) return;
    const next = transform.mesh.points.map((q, i) => i === idx ? { x: p.x / renderInfo.w, y: p.y / renderInfo.h } : q);
    setTransform({ mesh: { ...transform.mesh, points: next } });
  }

  return (
    <div className={styles.root}>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />
        {transform.mesh && renderInfo && (
          <MeshHandles
            cols={transform.mesh.cols}
            rows={transform.mesh.rows}
            points={transform.mesh.points}
            w={renderInfo.w}
            h={renderInfo.h}
            onDrag={dragMeshPoint}
          />
        )}
        <ReadoutStrip>
          SCALE {(transform.scale * 100).toFixed(1)}% · ROT {transform.rotation.toFixed(1)}° · WARP {transform.mesh ? 'ON' : 'OFF'} · {transform.mesh ? `${(transform.mesh.cols + 1) * (transform.mesh.rows + 1)} PTS` : '0 PTS'}
        </ReadoutStrip>
      </div>
      <aside className={styles.sidebar}>
        <MonoLabel size="label">Transform tools</MonoLabel>
        <button onClick={() => setTransform({ rotation: (transform.rotation + 90) % 360 })}>Rot 90°</button>
        <button onClick={() => setTransform({ flipH: !transform.flipH })}>Flip H</button>
        <button onClick={() => setTransform({ flipV: !transform.flipV })}>Flip V</button>
        <label>
          <MonoLabel size="label">Scale</MonoLabel>
          <input type="range" min={0.25} max={3} step={0.01} value={transform.scale}
            onChange={e => setTransform({ scale: +e.target.value })} />
        </label>
        <label>
          <MonoLabel size="label">Rotate free</MonoLabel>
          <input type="range" min={0} max={360} step={1} value={transform.rotation}
            onChange={e => setTransform({ rotation: +e.target.value })} />
        </label>
        <MonoLabel size="label">Mesh warp</MonoLabel>
        <button onClick={() => toggleMesh(4, 4)}>4 × 4</button>
        <button onClick={() => toggleMesh(6, 6)}>6 × 6</button>
        <button onClick={() => toggleMesh(8, 8)}>8 × 8</button>
        <button onClick={resetTransform}>Reset all</button>
        <div style={{ flex: 1 }} />
        <button onClick={advance}>Sections →</button>
      </aside>
    </div>
  );
}

function MeshHandles({
  cols, rows, points, w, h, onDrag
}: { cols: number; rows: number; points: { x: number; y: number }[]; w: number; h: number; onDrag: (i: number, p: { x: number; y: number }) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);
  useEffect(() => {
    if (dragging === null) return;
    function onMove(e: MouseEvent) {
      const wrap = document.getElementById('canvas-wrap')!;
      const r = wrap.getBoundingClientRect();
      onDrag(dragging!, { x: e.clientX - r.left, y: e.clientY - r.top });
    }
    function onUp() { setDragging(null); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, onDrag]);

  return (
    <svg id="canvas-wrap" style={{ position: 'absolute', inset: 0, width: w, height: h, pointerEvents: 'none' }}>
      {/* dotted grid lines */}
      {points.map((p, i) => {
        const col = i % (cols + 1);
        const row = Math.floor(i / (cols + 1));
        const right = points[i + 1];
        const down = points[i + cols + 1];
        return (
          <g key={i}>
            {col < cols && right && <line x1={p.x * w} y1={p.y * h} x2={right.x * w} y2={right.y * h} stroke="black" strokeDasharray="2 3" strokeWidth="1" />}
            {row < rows && down && <line x1={p.x * w} y1={p.y * h} x2={down.x * w} y2={down.y * h} stroke="black" strokeDasharray="2 3" strokeWidth="1" />}
          </g>
        );
      })}
      {/* handles */}
      {points.map((p, i) => (
        <rect
          key={`h-${i}`}
          x={p.x * w - 3} y={p.y * h - 3} width={6} height={6}
          fill="black" stroke="black"
          style={{ cursor: 'grab', pointerEvents: 'all' }}
          onMouseDown={() => setDragging(i)}
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 15.3: Smoke test**

Upload → enable mesh 4×4 → drag a few points → advance to sections. Working bitmap shows the warped result.

- [ ] **Step 15.4: Commit**

```bash
git add -A
git commit -m "step/transform: mesh warp via pixi + draggable handles"
```

---

### Task 16: SectionsStep

**Files:**
- Create: `src/app/steps/SectionsStep.tsx`
- Create: `src/app/steps/SectionsStep.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 16.1: Implement SectionsStep**

```tsx
// src/app/steps/SectionsStep.tsx
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { getBlob } from '@/lib/idb';
import { CursorAxisDetector } from '@/lib/cursor-axis-detector';
import { LeafAxisIndicator } from '@/components/LeafAxisIndicator';
import { MonoLabel } from '@/components/MonoLabel';
import { ReadoutStrip } from '@/components/ReadoutStrip';
import { buildCells } from '@/lib/cells';
import { useStore as _useStore } from '@/state/store';
import type { Axis } from '@/lib/cursor-axis-detector';
import styles from './SectionsStep.module.css';

export function SectionsStep() {
  const { workingBitmapId, lines, setLines, setStep, replaceCells } = useStore();
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const detector = useRef(new CursorAxisDetector());
  const [axis, setAxis] = useState<Axis | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [inside, setInside] = useState(false);

  useEffect(() => {
    if (!workingBitmapId) { setStep('transform'); return; }
    getBlob(workingBitmapId).then(blob => { if (blob) setImgUrl(URL.createObjectURL(blob)); });
    return () => { if (imgUrl) URL.revokeObjectURL(imgUrl); };
  }, [workingBitmapId, setStep]);

  function onMouseMove(e: React.MouseEvent) {
    const img = imgRef.current;
    if (!img) return;
    const r = img.getBoundingClientRect();
    const state = detector.current.update({ x: e.clientX, y: e.clientY }, { left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    setAxis(state.axis);
    setInside(state.inside);
    setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  function onClick() {
    if (!imgRef.current || !axis || !cursor || !inside) return;
    const r = imgRef.current.getBoundingClientRect();
    if (axis === 'vertical') {
      const x = cursor.x / r.width;
      setLines({ ...lines, v: [...lines.v, x].sort((a, b) => a - b) });
    } else {
      const y = cursor.y / r.height;
      setLines({ ...lines, h: [...lines.h, y].sort((a, b) => a - b) });
    }
  }

  function deleteLine(axis: 'v' | 'h', idx: number) {
    setLines({ ...lines, [axis]: lines[axis].filter((_, i) => i !== idx) });
  }

  function advance() {
    const cells = buildCells(lines);
    const map: Record<string, any> = {};
    const previous = _useStore.getState().cells;
    for (const c of cells) {
      const prev = previous[c.id];
      map[c.id] = prev ? { ...prev, ...c } : {
        ...c,
        text: '', fontFamily: 'Sligoil Micro Medium', textColor: null,
        k: 8, innerPad: 0.06, borderPad: 0.04, showBorder: true
      };
    }
    replaceCells(map);
    setStep('compose');
  }

  if (!imgUrl) return null;

  return (
    <div className={styles.root} ref={wrapRef}>
      <div
        className={styles.canvasWrap}
        onMouseMove={onMouseMove}
        onMouseLeave={() => { setAxis(null); setInside(false); setCursor(null); }}
        onClick={onClick}
      >
        <img ref={imgRef} src={imgUrl} className={styles.img} alt="" draggable={false} />

        {/* existing lines */}
        {lines.v.map((x, i) => (
          <div key={`v-${i}`} className={styles.lineV} style={{ left: `${x * 100}%` }}>
            <button className={styles.handle} onClick={(e) => { e.stopPropagation(); deleteLine('v', i); }} aria-label={`V${i}`} />
            <span className={styles.lineLabel}>V {x.toFixed(3)}</span>
          </div>
        ))}
        {lines.h.map((y, i) => (
          <div key={`h-${i}`} className={styles.lineH} style={{ top: `${y * 100}%` }}>
            <button className={styles.handle} onClick={(e) => { e.stopPropagation(); deleteLine('h', i); }} aria-label={`H${i}`} />
            <span className={styles.lineLabel}>H {y.toFixed(3)}</span>
          </div>
        ))}

        {/* axis guide following cursor */}
        {inside && axis && cursor && imgRef.current && (
          axis === 'vertical'
            ? <div className={styles.guideV} style={{ left: cursor.x }} />
            : <div className={styles.guideH} style={{ top: cursor.y }} />
        )}

        <div className={styles.indicator}>
          <LeafAxisIndicator axis={axis} />
        </div>

        <ReadoutStrip>
          AXIS {axis ?? '—'} · V {lines.v.length} · H {lines.h.length} · CELLS {(lines.v.length + 1) * (lines.h.length + 1)}
        </ReadoutStrip>
      </div>
      <aside className={styles.sidebar}>
        <MonoLabel size="label">Sections</MonoLabel>
        <MonoLabel>Enter image from top/bottom for vertical, sides for horizontal. Click to drop a line. Click a line's handle to delete.</MonoLabel>
        <div style={{ flex: 1 }} />
        <button onClick={() => setLines({ v: [], h: [] })}>Clear lines</button>
        <button onClick={advance}>Compose →</button>
      </aside>
    </div>
  );
}
```

```css
/* src/app/steps/SectionsStep.module.css */
.root { display: grid; grid-template-columns: 1fr 220px; gap: var(--s-5); height: calc(100vh - 160px); }
.canvasWrap { position: relative; border: var(--rule) solid var(--ink); overflow: hidden; cursor: crosshair; }
.img { display: block; max-width: 100%; max-height: 100%; user-select: none; }
.lineV { position: absolute; top: 0; bottom: 0; width: 0; border-left: var(--rule) solid var(--ink); }
.lineH { position: absolute; left: 0; right: 0; height: 0; border-top: var(--rule) solid var(--ink); }
.handle { position: absolute; width: 8px; height: 8px; padding: 0; background: var(--ink); border: 0; cursor: pointer; }
.lineV .handle { left: -4px; top: -4px; }
.lineH .handle { top: -4px; left: -4px; }
.lineLabel { position: absolute; font-family: var(--ui-font); font-size: var(--ui-label-size); letter-spacing: var(--ui-label-letter); text-transform: uppercase; background: var(--paper); padding: 2px 4px; border: var(--rule) solid var(--ink); }
.lineV .lineLabel { top: 8px; left: 6px; }
.lineH .lineLabel { left: 8px; top: 6px; }
.guideV { position: absolute; top: 0; bottom: 0; width: 0; border-left: var(--rule) dashed var(--ink); pointer-events: none; }
.guideH { position: absolute; left: 0; right: 0; height: 0; border-top: var(--rule) dashed var(--ink); pointer-events: none; }
.indicator { position: absolute; top: var(--s-3); right: var(--s-3); }
.sidebar { display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-3); border: var(--rule) solid var(--ink); }
```

- [ ] **Step 16.2: Wire SectionsStep**

In `App.tsx`, add `{step === 'sections' && <SectionsStep />}`.

- [ ] **Step 16.3: Smoke test**

Enter image from top → vertical guide appears → click → vertical line. Exit and re-enter from left → horizontal guide. Drop a few lines → advance.

- [ ] **Step 16.4: Commit**

```bash
git add -A
git commit -m "step/sections: cursor-direction gesture + drop V/H lines + cell build"
```

---

### Task 17: ComposeStep — focus animation + picker panel scaffold

**Files:**
- Create: `src/app/steps/ComposeStep.tsx`
- Create: `src/app/steps/ComposeStep.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 17.1: Implement ComposeStep with focused-cell morph (without palette yet — comes in 18)**

```tsx
// src/app/steps/ComposeStep.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { useStore } from '@/state/store';
import { getBlob } from '@/lib/idb';
import { CellTextRenderer } from '@/components/CellTextRenderer';
import { MonoLabel } from '@/components/MonoLabel';
import { ReadoutStrip } from '@/components/ReadoutStrip';
import { FontPicker } from '@/components/FontPicker';
import { KSlider } from '@/components/KSlider';
import { PaddingSlider } from '@/components/PaddingSlider';
import styles from './ComposeStep.module.css';

export function ComposeStep() {
  const { workingBitmapId, cells, upsertCell, setStep } = useStore();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!workingBitmapId) { setStep('sections'); return; }
    getBlob(workingBitmapId).then(blob => { if (blob) setImgUrl(URL.createObjectURL(blob)); });
  }, [workingBitmapId, setStep]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      setWrapSize({ w: cr.width, h: cr.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const cellList = useMemo(() => Object.values(cells).sort((a, b) => a.row - b.row || a.col - b.col), [cells]);
  const focused = focusedId ? cells[focusedId] : null;

  return (
    <LayoutGroup>
      <div className={styles.root}>
        <div className={styles.canvasWrap} ref={wrapRef}>
          {imgUrl && wrapSize && cellList.map(c => {
            const W = wrapSize.w, H = wrapSize.h;
            const isFocused = focusedId === c.id;
            return (
              <motion.button
                layoutId={`cell-${c.id}`}
                key={c.id}
                className={`${styles.cell} ${focusedId && !isFocused ? styles.blurred : ''}`}
                style={{
                  left: c.x * W, top: c.y * H, width: c.w * W, height: c.h * H,
                  backgroundImage: `url(${imgUrl})`,
                  backgroundSize: `${W}px ${H}px`,
                  backgroundPosition: `${-c.x * W}px ${-c.y * H}px`
                }}
                onClick={() => setFocusedId(c.id)}
                animate={isFocused ? { scale: 1.0, zIndex: 10 } : { scale: 1, zIndex: 1 }}
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Render the text composition on top of the image background */}
                <CellTextRenderer
                  cellW={c.w * W}
                  cellH={c.h * H}
                  text={c.text}
                  fontFamily={c.fontFamily}
                  color={c.textColor}
                  innerPad={c.innerPad}
                  borderPad={c.borderPad}
                  showBorder={c.showBorder}
                />
              </motion.button>
            );
          })}

          <ReadoutStrip>
            {focused
              ? `CELL ${focused.col},${focused.row} · ${Math.round((focused.w * (wrapSize?.w ?? 0)))}×${Math.round((focused.h * (wrapSize?.h ?? 0)))}PX · FONT ${focused.fontFamily}`
              : 'TAP A CELL TO COMPOSE'}
          </ReadoutStrip>
        </div>

        {focused && (
          <motion.aside
            layoutId="picker-panel"
            className={styles.sidebar}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
          >
            <MonoLabel size="label">Cell {focused.col},{focused.row}</MonoLabel>

            <label>
              <MonoLabel size="label">Text</MonoLabel>
              <textarea
                value={focused.text}
                rows={3}
                onChange={e => upsertCell({ ...focused, text: e.target.value })}
                autoFocus
              />
            </label>

            <PaddingSlider label="Inner padding" value={focused.innerPad}
              onChange={v => upsertCell({ ...focused, innerPad: v })} />
            <PaddingSlider label="Border padding" value={focused.borderPad}
              onChange={v => upsertCell({ ...focused, borderPad: v })} />

            <label>
              <input type="checkbox" checked={focused.showBorder}
                onChange={e => upsertCell({ ...focused, showBorder: e.target.checked })} />{' '}
              <MonoLabel size="label">Show border</MonoLabel>
            </label>

            <KSlider value={focused.k} onChange={v => upsertCell({ ...focused, k: v })} />

            <FontPicker value={focused.fontFamily} onChange={f => upsertCell({ ...focused, fontFamily: f })} />

            {/* Local swatch comes in Task 18 */}
            <div className={styles.swatchSlot} aria-label="palette placeholder" />

            <div style={{ flex: 1 }} />
            <button onClick={() => setFocusedId(null)}>Done</button>
            <button onClick={() => setStep('background')}>Background →</button>
          </motion.aside>
        )}

        {!focused && (
          <aside className={styles.sidebar}>
            <MonoLabel size="label">Compose</MonoLabel>
            <MonoLabel>Tap any cell to start composing. Tab / Shift+Tab walks reading order. Esc unfocuses.</MonoLabel>
            <div style={{ flex: 1 }} />
            <button onClick={() => setStep('background')}>Background →</button>
          </aside>
        )}
      </div>
    </LayoutGroup>
  );
}
```

```css
/* src/app/steps/ComposeStep.module.css */
.root { display: grid; grid-template-columns: 1fr 320px; gap: var(--s-5); height: calc(100vh - 160px); }
.canvasWrap { position: relative; border: var(--rule) solid var(--ink); overflow: hidden; }
.cell { position: absolute; padding: 0; border: var(--rule) solid var(--ink); background-repeat: no-repeat; cursor: pointer; transition: filter var(--t-base) var(--ease); }
.cell.blurred { filter: blur(6px) brightness(0.85); pointer-events: auto; }
.sidebar { display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-3); border: var(--rule) solid var(--ink); overflow-y: auto; }
.swatchSlot { width: 100%; aspect-ratio: 1 / 1; border: var(--rule) dashed var(--ink); display: flex; align-items: center; justify-content: center; opacity: 0.4; }
```

- [ ] **Step 17.2: Add Tab navigation + Esc**

Append to `ComposeStep` (inside the component, before return):

```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { setFocusedId(null); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ids = cellList.map(c => c.id);
      if (ids.length === 0) return;
      const idx = focusedId ? ids.indexOf(focusedId) : -1;
      const next = e.shiftKey
        ? (idx <= 0 ? ids.length - 1 : idx - 1)
        : (idx === -1 || idx === ids.length - 1 ? 0 : idx + 1);
      setFocusedId(ids[next]);
    }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [cellList, focusedId]);
```

- [ ] **Step 17.3: Smoke test**

Land on Compose. Tap a cell → it un-blurs, others blur, panel slides in. Type text → live render. Tab to next cell. Esc to unfocus.

- [ ] **Step 17.4: Commit**

```bash
git add -A
git commit -m "step/compose: focus/blur with framer-motion, picker panel scaffold, tab nav"
```

---

### Task 18: ComposeStep — per-cell palette extraction + DyadicSwatch wiring

**Files:**
- Create: `src/lib/sample-cell.ts`
- Modify: `src/app/steps/ComposeStep.tsx`

- [ ] **Step 18.1: Write `lib/sample-cell.ts`**

```ts
// src/lib/sample-cell.ts
export async function sampleCellPixels(
  bitmap: ImageBitmap,
  bounds: { x: number; y: number; w: number; h: number }
): Promise<Uint8ClampedArray> {
  const W = bitmap.width, H = bitmap.height;
  const sx = Math.round(bounds.x * W);
  const sy = Math.round(bounds.y * H);
  const sw = Math.max(1, Math.round(bounds.w * W));
  const sh = Math.max(1, Math.round(bounds.h * H));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  return ctx.getImageData(0, 0, sw, sh).data;
}
```

- [ ] **Step 18.2: Compute per-cell palette + render swatch**

In `ComposeStep.tsx`, replace the `swatchSlot` placeholder with:

```tsx
{focused && <CellPaletteSwatch focused={focused} />}
```

…and add the component below the main one in the same file:

```tsx
import { extractPalette } from '@/lib/palette';
import { dyadicLayout, type PlacedCell } from '@/lib/dyadic-layout';
import { sampleCellPixels } from '@/lib/sample-cell';
import { loadStoredImage } from '@/lib/image-io';
import { DyadicSwatch } from '@/components/DyadicSwatch';
import { rgbToHex, hexToRgb } from '@/lib/color-format';
import type { Cell } from '@/state/types';

function CellPaletteSwatch({ focused }: { focused: Cell }) {
  const { workingBitmapId, upsertCell } = useStore();
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [palette, setPalette] = useState<PlacedCell[]>([]);
  const [hoverHex, setHoverHex] = useState<string | null>(null);

  useEffect(() => {
    if (!workingBitmapId) return;
    loadStoredImage(workingBitmapId).then(setBitmap);
  }, [workingBitmapId]);

  useEffect(() => {
    if (!bitmap) return;
    let cancelled = false;
    (async () => {
      const pixels = await sampleCellPixels(bitmap, { x: focused.x, y: focused.y, w: focused.w, h: focused.h });
      const colors = extractPalette(pixels, { k: focused.k, seed: 1, sampleStride: 4 });
      if (cancelled) return;
      setPalette(dyadicLayout(colors));
    })();
    return () => { cancelled = true; };
  }, [bitmap, focused.x, focused.y, focused.w, focused.h, focused.k]);

  const selectedHex = focused.textColor ? rgbToHex(focused.textColor) : null;

  return (
    <div>
      <DyadicSwatch
        cells={palette}
        selected={selectedHex}
        onPick={(hex) => upsertCell({ ...focused, textColor: hexToRgb(hex) })}
        onHover={setHoverHex}
        layoutGroup="local"
      />
      <div style={{ minHeight: '1.5em', marginTop: 'var(--s-2)' }}>
        <MonoLabel size="value">{hoverHex ?? selectedHex ?? '—'}</MonoLabel>
      </div>
    </div>
  );
}
```

- [ ] **Step 18.3: Smoke test**

Focus a cell → palette computes and renders → click a swatch → text recolors. Move k slider → palette re-tiles smoothly.

- [ ] **Step 18.4: Commit**

```bash
git add -A
git commit -m "step/compose: per-cell palette extraction + dyadic swatch wired"
```

---

### Task 19: BackgroundStep

**Files:**
- Create: `src/app/steps/BackgroundStep.tsx`
- Create: `src/app/steps/BackgroundStep.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 19.1: Implement BackgroundStep**

```tsx
// src/app/steps/BackgroundStep.tsx
import { useEffect, useState } from 'react';
import { useStore } from '@/state/store';
import { loadStoredImage } from '@/lib/image-io';
import { sampleCellPixels } from '@/lib/sample-cell';
import { averageColor, extractPalette, type RGB } from '@/lib/palette';
import { dyadicLayout, type PlacedCell } from '@/lib/dyadic-layout';
import { DyadicSwatch } from '@/components/DyadicSwatch';
import { AverageBlock } from '@/components/AverageBlock';
import { MonoLabel } from '@/components/MonoLabel';
import { ReadoutStrip } from '@/components/ReadoutStrip';
import { hexToRgb, rgbToHex } from '@/lib/color-format';
import { CropMarks } from '@/components/CropMarks';
import styles from './BackgroundStep.module.css';

export function BackgroundStep() {
  const { workingBitmapId, background, setBackground, setStep } = useStore();
  const [palette, setPalette] = useState<PlacedCell[]>([]);
  const [avg, setAvg] = useState<RGB | null>(null);

  useEffect(() => {
    if (!workingBitmapId) { setStep('compose'); return; }
    (async () => {
      const bitmap = await loadStoredImage(workingBitmapId);
      if (!bitmap) return;
      const pixels = await sampleCellPixels(bitmap, { x: 0, y: 0, w: 1, h: 1 });
      const colors = extractPalette(pixels, { k: 32, seed: 1, sampleStride: 8 });
      setPalette(dyadicLayout(colors));
      setAvg(averageColor(pixels));
    })();
  }, [workingBitmapId, setStep]);

  const selectedHex = background ? rgbToHex(background) : null;
  const avgHex = avg ? rgbToHex(avg) : null;

  return (
    <div className={styles.root}>
      <CropMarks />
      <div className={styles.swatch}>
        <DyadicSwatch
          cells={palette}
          selected={selectedHex}
          onPick={hex => setBackground(hexToRgb(hex))}
          layoutGroup="global"
        />
      </div>
      <div className={styles.avg}>
        {avg && <AverageBlock rgb={avg} selected={selectedHex === avgHex} onPick={h => setBackground(hexToRgb(h))} />}
      </div>
      <ReadoutStrip>
        TYP0GLYPHIE · STEP 05 / 06 · BACKGROUND {selectedHex ?? '—'}
      </ReadoutStrip>
      <div className={styles.next}>
        <button onClick={() => setStep('compose')}>← Compose</button>
        <button onClick={() => setStep('export')}>Export →</button>
      </div>
    </div>
  );
}
```

```css
/* src/app/steps/BackgroundStep.module.css */
.root { position: relative; display: grid; grid-template-columns: 1fr 1fr; height: calc(100vh - 160px); border: var(--rule) solid var(--ink); }
.swatch { aspect-ratio: 1 / 1; width: 100%; align-self: center; }
.avg { width: 100%; height: 100%; }
.next { position: absolute; right: var(--s-5); top: var(--s-5); display: flex; gap: var(--s-2); z-index: 5; }
```

- [ ] **Step 19.2: Smoke test**

Pick a swatch → see selection. Pick the average. Navigate back and forward.

- [ ] **Step 19.3: Commit**

```bash
git add -A
git commit -m "step/background: global swatch + average picker"
```

---

### Task 20: ExportStep — PNG + SVG

**Files:**
- Create: `src/lib/export-png.ts`
- Create: `src/lib/export-svg.ts`
- Create: `src/app/steps/ExportStep.tsx`
- Create: `src/app/steps/ExportStep.module.css`
- Modify: `src/app/App.tsx`

- [ ] **Step 20.1: Write `lib/export-png.ts`**

```ts
// src/lib/export-png.ts
import { computeFit } from './typography-fit';
import { rgbToHex, type RGB } from './color-format';
import type { Cell } from '@/state/types';

export interface ExportArgs {
  width: number;
  height: number;
  background: RGB;
  cells: Cell[];
}

export async function exportPNG({ width, height, background, cells }: ExportArgs): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = rgbToHex(background);
  ctx.fillRect(0, 0, width, height);

  for (const c of cells) {
    const cw = c.w * width;
    const ch = c.h * height;
    const ox = c.x * width;
    const oy = c.y * height;

    ctx.font = `100px "${c.fontFamily}"`;
    const measurer = {
      refSize: 100,
      refLineHeight: 120,
      measureLineWidth: (line: string) => line ? ctx.measureText(line).width : 0
    };
    const m = ctx.measureText('M');
    if ('actualBoundingBoxAscent' in m && 'actualBoundingBoxDescent' in m) {
      measurer.refLineHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || 120;
    }

    const fit = computeFit({
      cellW: cw, cellH: ch, text: c.text,
      innerPad: c.innerPad, borderPad: c.borderPad, measurer
    });

    if (c.showBorder && c.borderPad > 0) {
      const bx = ox + c.borderPad * cw;
      const by = oy + c.borderPad * ch;
      const bw = cw - 2 * c.borderPad * cw;
      const bh = ch - 2 * c.borderPad * ch;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    }

    if (!fit.isEmpty) {
      ctx.fillStyle = c.textColor ? rgbToHex(c.textColor) : '#000';
      ctx.textBaseline = 'top';
      const startX = ox + (c.innerPad + c.borderPad) * cw;
      const startY = oy + (c.innerPad + c.borderPad) * ch;
      fit.lines.forEach((l, i) => {
        ctx.save();
        ctx.translate(startX, startY + i * fit.refLineHeight * l.scaleY);
        ctx.scale(l.scaleX, l.scaleY);
        ctx.fillText(l.text, 0, 0);
        ctx.restore();
      });
    }
  }

  return new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
}
```

- [ ] **Step 20.2: Write `lib/export-svg.ts`**

```ts
// src/lib/export-svg.ts
import { computeFit } from './typography-fit';
import { rgbToHex, type RGB } from './color-format';
import type { Cell } from '@/state/types';
import { createCanvasMeasurer } from './canvas-measurer';
import { CURATED_FONTS } from './font-registry';
import { getBlob } from './idb';

async function fontBase64(family: string, uploadedBlobId?: string): Promise<string | null> {
  // Embed local Sligoil or uploaded font as base64 data URI inside @font-face.
  if (family === 'Sligoil Micro Medium') {
    const res = await fetch('/fonts/Sligoil-MicroMedium.otf');
    const buf = await res.arrayBuffer();
    return `data:font/otf;base64,${arrayBufferToBase64(buf)}`;
  }
  if (uploadedBlobId) {
    const blob = await getBlob(uploadedBlobId);
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    return `data:font/otf;base64,${arrayBufferToBase64(buf)}`;
  }
  return null;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export interface SVGExportArgs {
  width: number;
  height: number;
  background: RGB;
  cells: Cell[];
  uploadedFontsByFamily: Map<string, string>; // family → blobId
}

export async function exportSVG({ width, height, background, cells, uploadedFontsByFamily }: SVGExportArgs): Promise<Blob> {
  const families = Array.from(new Set(cells.map(c => c.fontFamily)));
  const fontFaces: string[] = [];
  for (const family of families) {
    const isCurated = CURATED_FONTS.some(f => f.family === family);
    if (isCurated && family !== 'Sligoil Micro Medium') {
      // Google Font — emit a <style> @import (works in browsers; not great for offline). Better: skip.
      continue;
    }
    const dataUri = await fontBase64(family, uploadedFontsByFamily.get(family));
    if (dataUri) {
      fontFaces.push(`@font-face { font-family: "${family}"; src: url('${dataUri}') format('opentype'); font-weight: 700; }`);
    }
  }

  const bg = rgbToHex(background);
  const rects = [`<rect width="${width}" height="${height}" fill="${bg}"/>`];

  for (const c of cells) {
    const measurer = createCanvasMeasurer(c.fontFamily);
    const cw = c.w * width;
    const ch = c.h * height;
    const ox = c.x * width;
    const oy = c.y * height;

    const fit = computeFit({
      cellW: cw, cellH: ch, text: c.text,
      innerPad: c.innerPad, borderPad: c.borderPad, measurer
    });

    if (c.showBorder && c.borderPad > 0) {
      const bx = ox + c.borderPad * cw;
      const by = oy + c.borderPad * ch;
      const bw = cw - 2 * c.borderPad * cw;
      const bh = ch - 2 * c.borderPad * ch;
      rects.push(`<rect x="${bx + 0.5}" y="${by + 0.5}" width="${bw - 1}" height="${bh - 1}" fill="none" stroke="#000" stroke-width="1"/>`);
    }

    if (!fit.isEmpty) {
      const color = c.textColor ? rgbToHex(c.textColor) : '#000';
      const startX = ox + (c.innerPad + c.borderPad) * cw;
      const startY = oy + (c.innerPad + c.borderPad) * ch;
      fit.lines.forEach((l, i) => {
        const ty = startY + i * fit.refLineHeight * l.scaleY;
        rects.push(`<text x="0" y="${fit.refSize}" font-family="${c.fontFamily}" font-size="${fit.refSize}" fill="${color}" transform="translate(${startX} ${ty}) scale(${l.scaleX} ${l.scaleY})">${escapeXml(l.text)}</text>`);
      });
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><style>${fontFaces.join('\n')}</style></defs>
  <title>typ0glyphie composition</title>
  <desc>Made with typ0glyphie · ${new Date().toISOString()}</desc>
  ${rects.join('\n')}
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
```

- [ ] **Step 20.3: Implement `ExportStep.tsx`**

```tsx
// src/app/steps/ExportStep.tsx
import { useState } from 'react';
import { useStore } from '@/state/store';
import { exportPNG } from '@/lib/export-png';
import { exportSVG } from '@/lib/export-svg';
import { averageColor } from '@/lib/palette';
import { sampleCellPixels } from '@/lib/sample-cell';
import { loadStoredImage } from '@/lib/image-io';
import { MonoLabel } from '@/components/MonoLabel';
import { ReadoutStrip } from '@/components/ReadoutStrip';
import styles from './ExportStep.module.css';

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportStep() {
  const { cells, background, exportScale, setExportScale, workingBitmapId, fonts, setStep } = useStore();
  const [busy, setBusy] = useState(false);

  async function resolvedBackground() {
    if (background) return background;
    if (!workingBitmapId) return [255, 255, 255] as const;
    const bitmap = await loadStoredImage(workingBitmapId);
    if (!bitmap) return [255, 255, 255] as const;
    const pixels = await sampleCellPixels(bitmap, { x: 0, y: 0, w: 1, h: 1 });
    return averageColor(pixels) ?? [255, 255, 255];
  }

  async function exportImage(format: 'png' | 'svg') {
    if (!workingBitmapId) return;
    setBusy(true);
    try {
      const bitmap = await loadStoredImage(workingBitmapId);
      if (!bitmap) return;
      const base = { w: bitmap.width, h: bitmap.height };
      const W = base.w * (exportScale === 'custom' ? 1 : exportScale);
      const H = base.h * (exportScale === 'custom' ? 1 : exportScale);
      const bg = await resolvedBackground();
      const cellList = Object.values(cells);

      if (format === 'png') {
        const blob = await exportPNG({ width: W, height: H, background: bg as any, cells: cellList });
        download(blob, `typ0glyphie-${nowStamp()}.png`);
      } else {
        const uploadedMap = new Map(fonts.uploaded.map(f => [f.family, f.fileBlobId]));
        const blob = await exportSVG({ width: W, height: H, background: bg as any, cells: cellList, uploadedFontsByFamily: uploadedMap });
        download(blob, `typ0glyphie-${nowStamp()}.svg`);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <MonoLabel size="label">Export</MonoLabel>
        <MonoLabel size="value">{nowStamp()}</MonoLabel>
        <label>
          <MonoLabel size="label">Scale</MonoLabel>
          <select value={exportScale === 'custom' ? 'custom' : String(exportScale)}
            onChange={e => setExportScale(e.target.value === 'custom' ? 'custom' : (Number(e.target.value) as 1 | 2))}>
            <option value="1">1×</option>
            <option value="2">2×</option>
          </select>
        </label>
        <div className={styles.actions}>
          <button disabled={busy} onClick={() => exportImage('png')}>Download PNG</button>
          <button disabled={busy} onClick={() => exportImage('svg')}>Download SVG</button>
        </div>
        <button onClick={() => setStep('background')}>← Background</button>
      </div>
      <ReadoutStrip>EXPORT · TYP0GLYPHIE · STEP 06 / 06</ReadoutStrip>
    </div>
  );
}
```

```css
/* src/app/steps/ExportStep.module.css */
.root { position: relative; height: calc(100vh - 160px); display: flex; align-items: center; justify-content: center; }
.card { display: flex; flex-direction: column; gap: var(--s-3); padding: var(--s-6); border: var(--rule) solid var(--ink); min-width: 360px; }
.actions { display: flex; gap: var(--s-2); }
```

- [ ] **Step 20.4: Smoke test**

Walk through full flow, export both PNG and SVG. Open both — verify text fills cells with chosen colors on chosen background.

- [ ] **Step 20.5: Commit**

```bash
git add -A
git commit -m "step/export: png + svg of typography-only composition"
```

---

## Phase 6 · Polish

### Task 21: Designer readouts pass — wire ReadoutStrip into every step, add G & I toggles

**Files:**
- Modify: `src/app/steps/TransformStep.tsx` — add `I` key for inline numeric edit mode
- Modify: `src/app/steps/SectionsStep.tsx` — add `G` toggle for percentages-overlay; click line label to edit value
- Modify: `src/app/steps/ComposeStep.tsx` — add `G` toggle for cell-dim overlay

- [ ] **Step 21.1: Add `I` key handler in TransformStep**

In `TransformStep`, add a `[edit, setEdit]` state. Bind `I` keydown to toggle. When `edit` is true, render `<input type="number">` next to the readout strip showing each value editable.

```tsx
// inside TransformStep
const [edit, setEdit] = useState(false);
useEffect(() => {
  function onKey(e: KeyboardEvent) { if (e.key.toLowerCase() === 'i') setEdit(v => !v); }
  window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
}, []);

// replace ReadoutStrip with:
<ReadoutStrip>
  {edit ? (
    <span>
      SCALE <input style={{ width: 60 }} type="number" step={0.01} min={0.25} max={3} value={transform.scale}
        onChange={e => setTransform({ scale: +e.target.value })} />
      · ROT <input style={{ width: 60 }} type="number" step={1} min={0} max={360} value={transform.rotation}
        onChange={e => setTransform({ rotation: +e.target.value })} />°
    </span>
  ) : (
    `SCALE ${(transform.scale * 100).toFixed(1)}% · ROT ${transform.rotation.toFixed(1)}° · WARP ${transform.mesh ? 'ON' : 'OFF'} · ${transform.mesh ? `${(transform.mesh.cols + 1) * (transform.mesh.rows + 1)} PTS` : '0 PTS'}`
  )}
</ReadoutStrip>
```

- [ ] **Step 21.2: SectionsStep — `G` toggle and editable line labels**

```tsx
// add inside SectionsStep
const [showInfo, setShowInfo] = useState(false);
useEffect(() => {
  function onKey(e: KeyboardEvent) { if (e.key.toLowerCase() === 'g') setShowInfo(v => !v); }
  window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
}, []);

// where lineLabel renders, switch to a button:
<button className={styles.lineLabel} onClick={(e) => {
  e.stopPropagation();
  const next = parseFloat(prompt(`Set V position 0..1`, x.toFixed(3)) || `${x}`);
  if (!isNaN(next) && next > 0 && next < 1) {
    setLines({ ...lines, v: lines.v.map((q, j) => i === j ? next : q).sort((a, b) => a - b) });
  }
}}>V {x.toFixed(3)}</button>

// and for the horizontal line label:
<button className={styles.lineLabel} onClick={(e) => {
  e.stopPropagation();
  const next = parseFloat(prompt(`Set H position 0..1`, y.toFixed(3)) || `${y}`);
  if (!isNaN(next) && next > 0 && next < 1) {
    setLines({ ...lines, h: lines.h.map((q, j) => i === j ? next : q).sort((a, b) => a - b) });
  }
}}>H {y.toFixed(3)}</button>
```

Add when `showInfo` is true: render a grid overlay (similar to the cells in compose) but read-only.

- [ ] **Step 21.3: ComposeStep — `G` toggle**

```tsx
// add inside ComposeStep
const [showGrid, setShowGrid] = useState(false);
useEffect(() => {
  function onKey(e: KeyboardEvent) { if (e.key.toLowerCase() === 'g') setShowGrid(v => !v); }
  window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
}, []);

// inside each cell, conditional overlay:
{showGrid && (
  <span style={{ position: 'absolute', left: 4, top: 4, fontFamily: 'var(--ui-font)', fontSize: 10, letterSpacing: '0.2em', background: 'white', padding: 2 }}>
    {`${Math.round(c.w * (wrapSize?.w ?? 0))}×${Math.round(c.h * (wrapSize?.h ?? 0))}`}
  </span>
)}
```

- [ ] **Step 21.4: Commit**

```bash
git add -A
git commit -m "polish: designer readouts — G grid info, I inline edit, editable line labels"
```

---

### Task 22: Undo / redo

**Files:**
- Create: `src/lib/undo-stack.ts`
- Modify: `src/state/store.ts` — emit snapshots on mutating actions; add undo/redo methods
- Create: `src/lib/__tests__/undo-stack.test.ts`
- Modify: `src/app/App.tsx` — register `⌘Z` / `⌘⇧Z` global key handler

- [ ] **Step 22.1: Write failing test**

```ts
// src/lib/__tests__/undo-stack.test.ts
import { describe, it, expect } from 'vitest';
import { UndoStack } from '../undo-stack';

describe('UndoStack', () => {
  it('records, undoes, redoes', () => {
    const stack = new UndoStack<number>(5);
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.undo()).toBe(2);
    expect(stack.undo()).toBe(1);
    expect(stack.redo()).toBe(2);
  });

  it('respects max size', () => {
    const stack = new UndoStack<number>(2);
    stack.push(1); stack.push(2); stack.push(3); stack.push(4);
    expect(stack.undo()).toBe(3);
    expect(stack.undo()).toBe(2);
    expect(stack.undo()).toBe(null);  // shouldn't drop past oldest retained
  });

  it('clearing redo stack on push after undo', () => {
    const stack = new UndoStack<number>(5);
    stack.push(1); stack.push(2); stack.push(3);
    stack.undo();
    stack.push(99);
    expect(stack.redo()).toBe(null);   // new push wiped redo
  });
});
```

Run: FAIL.

- [ ] **Step 22.2: Implement `lib/undo-stack.ts`**

```ts
// src/lib/undo-stack.ts
export class UndoStack<T> {
  private back: T[] = [];
  private fwd: T[] = [];
  constructor(private max: number) {}

  push(snapshot: T) {
    this.back.push(snapshot);
    if (this.back.length > this.max) this.back.shift();
    this.fwd = [];
  }
  undo(): T | null {
    if (this.back.length < 2) return null;
    const cur = this.back.pop()!;
    this.fwd.push(cur);
    return this.back[this.back.length - 1];
  }
  redo(): T | null {
    const r = this.fwd.pop();
    if (!r) return null;
    this.back.push(r);
    return r;
  }
  reset(initial: T) { this.back = [initial]; this.fwd = []; }
}
```

Run test. Expected: PASS.

- [ ] **Step 22.3: Integrate undo stack into store**

Append the following to the bottom of `src/state/store.ts` (after the `create()` call that builds `useStore`):

```ts
// src/state/store.ts (append)
import { UndoStack } from '@/lib/undo-stack';

function stripFonts(s: Store): ProjectState {
  const { fonts: _f, setStep: _1, setSourceImageId: _2, setTransform: _3,
    resetTransform: _4, setWorkingBitmapId: _5, setLines: _6, upsertCell: _7,
    removeCell: _8, replaceCells: _9, setBackground: _10, setExportScale: _11,
    setExportCustom: _12, addUploadedFont: _13, removeUploadedFont: _14,
    resetProject: _15, ...project } = s;
  return project as ProjectState;
}

const undoStack = new UndoStack<ProjectState>(50);
undoStack.reset(stripFonts(useStore.getState()));

let suspendUndo = false;
useStore.subscribe((state) => {
  if (suspendUndo) return;
  undoStack.push(stripFonts(state));
});

export function undo() {
  const snap = undoStack.undo();
  if (!snap) return;
  suspendUndo = true;
  useStore.setState({ ...snap }, false);
  suspendUndo = false;
}

export function redo() {
  const snap = undoStack.redo();
  if (!snap) return;
  suspendUndo = true;
  useStore.setState({ ...snap }, false);
  suspendUndo = false;
}
```

(Zustand 4's `subscribe(listener)` calls back on every state change. We strip the action methods and the fonts slice before pushing — only the project data lives in the undo history.)

- [ ] **Step 22.4: Register global key handler in App**

```tsx
// in src/app/App.tsx
import { undo, redo } from '@/state/store';

useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || e.key.toLowerCase() !== 'z') return;
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

- [ ] **Step 22.5: Smoke test**

Place a section line, ⌘Z → line gone, ⌘⇧Z → line restored. Type a letter into a cell, undo/redo works.

- [ ] **Step 22.6: Commit**

```bash
git add -A
git commit -m "polish: global undo/redo with 50-step persisted stack"
```

---

### Task 23: User font upload

**Files:**
- Create: `src/lib/font-io.ts`
- Modify: `src/components/FontPicker.tsx` — add upload button

- [ ] **Step 23.1: Write `lib/font-io.ts`**

```ts
// src/lib/font-io.ts
import { putBlob, getBlob, newBlobId } from './idb';
import { useStore } from '@/state/store';

export async function registerFontFromFile(file: File): Promise<string | null> {
  const buffer = await file.arrayBuffer();
  // Derive a family name: prefer file name without extension.
  const family = file.name.replace(/\.[a-zA-Z0-9]+$/, '');
  const face = new FontFace(family, buffer);
  await face.load();
  (document as any).fonts.add(face);
  const blobId = newBlobId('font');
  await putBlob(blobId, file);
  useStore.getState().addUploadedFont(family, blobId);
  return family;
}

export async function reloadUploadedFonts(): Promise<void> {
  const fonts = useStore.getState().fonts.uploaded;
  for (const f of fonts) {
    const blob = await getBlob(f.fileBlobId);
    if (!blob) continue;
    const face = new FontFace(f.family, await blob.arrayBuffer());
    await face.load();
    (document as any).fonts.add(face);
  }
}
```

Call `reloadUploadedFonts()` once on app start (in `App.tsx` `useEffect`).

- [ ] **Step 23.2: Add upload affordance to FontPicker**

```tsx
// FontPicker.tsx — append below the <select>
const inputRef = useRef<HTMLInputElement>(null);
return (
  <div>
    <select ... />
    <button onClick={() => inputRef.current?.click()}>Upload font</button>
    <input ref={inputRef} type="file" accept=".otf,.ttf" hidden
      onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        const family = await registerFontFromFile(f);
        if (family) onChange(family);
      }} />
  </div>
);
```

- [ ] **Step 23.3: Smoke test**

Upload an OTF / TTF → font appears in dropdown, selecting it changes the focused cell's font. Refresh page — font persists.

- [ ] **Step 23.4: Commit**

```bash
git add -A
git commit -m "polish: user-uploaded TTF/OTF fonts via FontFace + idb persistence"
```

---

### Task 24: Animation polish pass

**Files:**
- Modify: each step file as needed

- [ ] **Step 24.1: Tune timings**

For each `motion` element, ensure `transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}` for layout morphs and `{ duration: 0.22, ... }` for fades. Replace any default Framer Motion springs with the explicit timings to match the brutalist deliberate feel.

- [ ] **Step 24.2: ComposeStep — exit blur animation**

When a cell unfocuses, animate `filter` from blurred to clear with a 320ms duration rather than CSS transition. Use `motion.div` and `animate={{ filter: focusedId && !isFocused ? 'blur(6px) brightness(0.85)' : 'blur(0px) brightness(1)' }}`.

- [ ] **Step 24.3: BackgroundStep — entry transition from compose thumbnail**

In `App.tsx` wrap step rendering in `<LayoutGroup>` and `<AnimatePresence mode="wait">`. Each step's root gets a `motion.div` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}`. Add `layoutId="step-canvas"` to make the canvas areas morph.

- [ ] **Step 24.4: Commit**

```bash
git add -A
git commit -m "polish: tuned animation timings + step crossfade morph"
```

---

### Task 25: Visual regression baselines + happy-path Playwright

**Files:**
- Create: `e2e/happy-path.spec.ts`
- Create: `e2e/fixtures/sample.png` (a small test image — generate with a script or use any local image)
- Create: `e2e/visual-regression.spec.ts`

- [ ] **Step 25.1: Create a test fixture image**

```bash
# Generate a 320×240 sample image with ImageMagick (or copy any image)
mkdir -p e2e/fixtures
convert -size 320x240 plasma:fractal e2e/fixtures/sample.png 2>/dev/null || \
  curl -L -o e2e/fixtures/sample.png "https://picsum.photos/id/237/320/240"
```

- [ ] **Step 25.2: Write happy-path test**

```ts
// e2e/happy-path.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test('upload → transform → sections → compose → background → export PNG', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Drop an image')).toBeVisible();

  const filePath = path.resolve(__dirname, 'fixtures/sample.png');
  await page.locator('input[type=file]').setInputFiles(filePath);

  // Wait for transform step
  await expect(page.getByText('Rot 90°')).toBeVisible();
  await page.getByRole('button', { name: 'Sections →' }).click();

  // Sections — place one vertical line by clicking center
  const img = page.locator('img').first();
  const box = (await img.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y - 10);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole('button', { name: 'Compose →' }).click();

  // Compose — focus a cell, type
  await page.locator('button[layoutid^="cell-"]').first().click();
  await page.locator('textarea').fill('TYP0');
  await page.getByRole('button', { name: 'Background →' }).click();

  // Background — pick the average
  await page.getByRole('button', { name: /Use average color/ }).click();
  await page.getByRole('button', { name: 'Export →' }).click();

  // Export
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/typ0glyphie-\d+-\d+\.png/);
});
```

- [ ] **Step 25.3: Write visual-regression spec**

```ts
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test('upload screen matches baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('upload.png');
});
```

- [ ] **Step 25.4: Generate baselines**

```bash
npx playwright install
npm run test:e2e:update
```

- [ ] **Step 25.5: Run full suite**

```bash
npm test
npm run test:e2e
```

Expected: all pass.

- [ ] **Step 25.6: Commit**

```bash
git add -A
git commit -m "tests: playwright happy-path + visual regression baseline"
```

---

## Done

At this point the spec's full feature surface is implemented and tested. To verify against the spec, walk it section by section:

| Spec section | Tasks |
|---|---|
| §1 UPLOAD | 13 |
| §2 TRANSFORM | 14, 15 |
| §3 SECTIONS | 7, 11 (indicator), 16, 21 (G & line edit) |
| §4 COMPOSE | 12, 17, 18, 21 (G) |
| §5 Dyadic algorithm | 5, 9 (component), 18 (per-cell), 19 (global) |
| §6 Typography fit | 6, 10 |
| §7 BACKGROUND | 19 |
| §8 EXPORT | 20 |
| §9 Designer readouts | 11 (ReadoutStrip), 21 (toggles), 22 (undo) |
| §10 Persistence | 8 (store + idb), 23 (font persist) |
| §11 Curated font set | 11, 23 |
| §12 Module breakdown | every task |
| §13 Testing | 4–8, 12, 22 (unit), 25 (e2e + visual) |
| §14 Out of scope | enforced by absence |
