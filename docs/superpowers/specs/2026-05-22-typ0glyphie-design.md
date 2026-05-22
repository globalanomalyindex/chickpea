# typ0glyphie — Design Spec

**Date:** 2026-05-22
**Status:** Brainstormed, approved for planning
**Author:** Christopher Robin Fiore (with Claude)

## What it is

A browser-based typography toy and portfolio piece. The user uploads an image, slices it into a grid of cells with vertical and horizontal lines, picks colors out of each cell's local palette, types text that squeeze-fills each cell perfectly, then chooses a background from the image's global palette or its average. Export as PNG or SVG.

The output is bold, graphic, brutalist typography colored by the composition of the source image. The application itself reads like a printer's proof sheet — pure black on white, Sligoil pixel-mono everywhere, hairline 1px rules, registration / crop-mark ornament, zero shadows or gradients.

## Aesthetic & feel

- **Brutalist graphic minimalism** — looks like an old printing press is at work
- **Single-page morphing toy** — no navigation, no modal system, no page transitions; the whole UI is one composition that re-flows fluidly between states via shared-element transitions
- **Toy that respects designers** — playful gestures, but every value the user adjusts has a precise numeric readout in Sligoil mono caps

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **React + Vite + TypeScript** | Standard, fast dev, ecosystem fit |
| Animation | **Framer Motion** (`motion`) | `layout` / `layoutId` shared-element transitions are the engine of the morphing-page feel |
| Mesh warp | **PixiJS** via `@pixi/react` | The only step that needs WebGL; a textured plane with draggable control points |
| Image render | **Canvas 2D** | Simpler than WebGL for the working bitmap, sections preview, and color sampling |
| State | **Zustand** + `persist` middleware | Lightweight, built-in localStorage, no Redux overhead |
| Font loading | **FontFace API** + IndexedDB | For user-uploaded TTF/OTF persisted across sessions |
| UI font | **Sligoil Micro Medium** (OFL, bundled) | The voice of the toy |
| Testing | **Vitest** + **Playwright** | Unit + visual regression |

No router. No modal library. No icon library — all "icons" are tiny SVG figures drawn inline at hairline weight.

## App states

A single state machine. Forward navigation is gestural where natural, but every step is revisitable and backward navigation never destroys downstream work whose preconditions still hold.

| # | Step | Outcome |
|---|---|---|
| 01 | **UPLOAD** | Source image loaded into memory |
| 02 | **TRANSFORM** | Image scaled, rotated, perspective-warped, mesh-warped; result rasterized to a working bitmap |
| 03 | **SECTIONS** | Vertical and horizontal lines placed on the working bitmap, forming a grid of cells |
| 04 | **COMPOSE** | For each cell: k-means palette, text content, font, color, padding |
| 05 | **BACKGROUND** | One color chosen from the global dyadic swatch or the global average |
| 06 | **EXPORT** | PNG or SVG download of the typography-only composition |

---

## §1 · UPLOAD (step 01)

Drag-and-drop or click to pick a file. PNG, JPG, WEBP, GIF (first frame). On load, advance.

The page during this state is mostly empty — Sligoil-mono caption in the center reading `DROP AN IMAGE`, crop-mark ticks in the corners. The drop-target rectangle is a 1px black hairline outline that scales fluidly as the window resizes.

A small "CLEAR" affordance appears once an image is already in localStorage, allowing explicit reset to a fresh project.

---

## §2 · TRANSFORM (step 02)

PixiJS stage hosts the source image as a textured plane. A toolbar on the right lists the tools — each labeled in Sligoil mono caps.

**Tools (all opt-in; advancing without using any tool simply rasterizes the source as-is):**

- **SCALE** — uniform scale; drag handle on a plane corner; `[` / `]` for 1% steps
- **ROT 90°** — single tap rotates 90° CW; discrete
- **ROT FREE** — drag a handle at the plane's top-center to rotate around its midpoint; `Shift` for 15° snaps
- **FLIP H** / **FLIP V** — single-tap toggles
- **PERSPECTIVE** — 4 draggable corner control points; transform applied via Pixi `Mesh`
- **MESH WARP** — configurable NxM grid of draggable vertex control points (default 4×4; user can bump to 6×6 or 8×8); drag any vertex to deform the texture; hold `Alt` to drag a vertex's neighbors with falloff

**Reset:** per-tool reset; "RESET ALL" at the top of the sidebar.

**Readout strip (bottom of canvas):**
`SCALE 100.0% · ROT 0.0° · WARP ON · 16 PTS`. Pressing `I` switches the bar to inline editable inputs — type a value for exact control.

**Visual details:**
- Plane bounding box: 1px black rectangle
- Control-point handles: 4×4px black squares; active handle 6×6 with a 1px ring
- Mesh warp grid: 1px dotted black hairlines

**Step exit:** on advance, the Pixi stage rasterizes to a still bitmap. That bitmap is the source for every downstream step. The transform parameters are persisted so the user can return and adjust; re-advancing re-rasterizes.

---

## §3 · SECTIONS (step 03)

The working bitmap fills the canvas area. The user places vertical and horizontal lines to slice it into cells.

### The cursor-entry-direction gesture

The page tracks which edge of the canvas bounding box the cursor crossed last:

- Entered through **top or bottom** → **vertical** mode; cursor displays a full-height vertical guide that tracks pointer X
- Entered through **left or right** → **horizontal** mode; cursor displays a full-width horizontal guide that tracks pointer Y
- The axis lock persists while the cursor is over the canvas
- Exiting the canvas clears the lock; next entry re-detects

**Corner case:** when the cursor crosses two edges in the same frame (mathematical corner intersection), the edge with the larger crossing displacement in that frame wins — deterministic, no flicker.

**Click** while a guide is live drops a permanent line at the current position. Existing lines can be grabbed by their handle (a 6×6 black square at the line's image-edge endpoint) and dragged to reposition, or dragged off the image to delete.

### Axis indicator

A small abstracted figure in the top-right corner: one heavy primary line with three perpendicular branches off it. Rotates 90° with a 220ms ease whenever the axis lock flips. Pure geometry — no leaf imagery — but the *mechanism* of leaf venation (midrib + lateral veins) is what determines axis intent.

### Section data model

A "section" is a **grid cell** formed by the union of vertical and horizontal cuts. Irregular grids are fully supported — even 1 vertical line + 0 horizontal lines = 2 cells. 0 lines + 0 lines = 1 cell (the whole image). The grid can be sparse and asymmetric.

Line positions are stored normalized 0..1 against the bitmap dimensions, so they survive transform-step re-rasters and viewport resizes.

### Line readouts

Placed lines display a tiny Sligoil-mono label at their image-edge endpoint: `V 0.382` or `H 0.671`. Click the label to type an exact value.

### Touch fallback

On touch devices, two pill toggles at the top of the canvas (V / H) replace the entry-direction detection. Mouse is the primary interaction.

---

## §4 · COMPOSE (step 04)

The heart of the tool.

### Default view

The section-divided bitmap sits on the page. **All cells are blurred** (`filter: blur(6px) brightness(0.85)`) and dimmed. No cell is focused. Above the canvas, a Sligoil caption: `TAP A CELL TO COMPOSE`.

### Focused-cell view

Tapping a cell un-blurs and centers it. The cell animates to the center of the canvas area at a comfortable working size; the other cells stay blurred and slide outward to make room.

The **per-cell picker panel** morphs in to the right of the focused cell. Inside the panel, stacked top-to-bottom:

1. **Text input** — Sligoil mono caps, autofocus, multi-line (`Shift+Enter` inserts newline)
2. **Inner-padding slider** (0–30% of cell, with numeric readout)
3. **Border-padding slider** (0–30% of cell, with numeric readout; renders a visible black hairline rectangle around the type area, toggleable)
4. **k-color slider** (k=2…64) for the cell's local palette — k-means/median-cut extraction
5. **Dyadic swatch** — fills the remaining vertical space of the panel; clicking a tile sets text color; current selection is ringed with 1px black
6. **Font dropdown** — the 12 curated free fonts + any uploaded fonts

### Live render

Every input updates the focused cell's render in real time:
- Text squeeze-fills the (cell − padding) rectangle via the §6 algorithm
- Font, color, and padding apply instantly

### Navigation

- **Tap any other (blurred) cell** → that cell takes focus; the picker panel's swatch re-tiles to the new cell's local palette via Framer Motion `layoutId` (tiles morph positions, colors crossfade where palette overlap exists, new colors fade in, missing ones fade out)
- **Tap outside any cell** → all cells unblur, no focus, composition view
- `Tab` / `Shift+Tab` → walk cells in natural reading order (left→right, top→bottom)
- `Esc` → exit focus

### Header readout

Inside the per-cell picker panel:
`CELL 2,1 · 412×280PX · 1.47:1 · STRETCH 0.83/1.12 · FONT SLIGOIL MICRO MED 240PT`

So the designer always knows the exact non-uniform scale being applied.

### Empty cell

A single 1px black registration cross at the cell's center. Serves as a "tap me" hint.

---

## §5 · Dyadic swatch algorithm

The picker's geometry. Identical routine for global swatch (whole bitmap) and per-cell swatch (cell pixels) — only the input pixels change.

### Input
Array of `{ rgb: [r, g, b], weight: number }` from k-means on the source region. The weight is the count of source pixels assigned to that cluster.

### Output
Array of `{ rgb, x, y, w, h }` where each entry tiles a unit square exactly. All cells are themselves squares.

### Procedure

1. Normalize weights so they sum to 1
2. Quantize each weight to the nearest **power-of-4 fraction of the square's area**: 1/4, 1/16, 1/64, 1/256
3. The floor is `MIN_AREA = 1/256` — the smallest swatch occupies a 1/16 × 1/16 region; with the hover-scale of 1.18× that gives a comfortable click target on any reasonable display
4. Sort colors by quantized area descending
5. Walk a `freeSquares` list, initialized to `[{x:0, y:0, w:1, h:1}]`. For each color (largest first):
   - Pop the largest free square from the list
   - If the color's quantized area equals that square's area → place the color in it
   - Otherwise → place the color in the top-left quadrant of that square; push the remaining three quadrants onto the `freeSquares` list (top-right, bottom-left, bottom-right in that order)
6. Continue until all colors are placed
7. If any `freeSquares` remain after all colors are placed, fill them with cloned lowest-weight colors
8. Cap the total visible swatches at 85 (drop lowest-weight colors that would exceed). Tunable constant

### Guarantees

- Output is always a complete, perfectly tiled square — no gaps, no overflow
- Every cell is a square (the algorithm never produces non-square subdivisions)
- The dominant color always lands in the top-left
- The square always fits a fixed visual frame regardless of how many distinct colors the image yields

### Inter-palette animation

Each rect carries a key derived from its color identity (`rgb` → nearest-match against previous palette's colors, with a small tolerance). Framer Motion `layoutId = key` lets cells smoothly morph positions when the user switches between cells with different but overlapping palettes. New colors fade in; vanishing colors fade out.

---

## §6 · Typography fit algorithm

How a text string fills a cell perfectly regardless of length.

### Input
- Cell rect `(W, H)` in pixels
- Text string (may contain `\n`)
- Font face reference
- Inner padding `p_i` (fraction of cell)
- Border padding `p_b` (fraction of cell)

### Procedure

1. **Fill rect:**
   `F.w = W − 2·(p_i + p_b)·W`
   `F.h = H − 2·(p_i + p_b)·H`
2. Split text on `\n` into N lines
3. At a **reference font size** (e.g., 100px), use Canvas `measureText` on the chosen font face to get each line's intrinsic width `lw_i`. Record the font's intrinsic line height `lh`
4. **Per-line scaleX** to normalize all lines to the same final width:
   `perLineScaleX[i] = max(lw_j for all j) / lw_i`
5. **Global block scaleX** to make the widest line exactly fill the cell width:
   `globalScaleX = F.w / max(lw_j)`
6. **Global block scaleY** to make the stacked block exactly fill the cell height:
   `globalScaleY = F.h / (N · lh)`
7. **Final per-line transform:**
   `transform: scale(globalScaleX · perLineScaleX[i], globalScaleY)`
8. Color = the selected swatch hex; fill, not stroke

### Result

Text always exactly fills the cell minus padding. One letter → enormous. A long sentence → flattened to fit. Multi-line blocks read as a tight bar of typography because per-line widths normalize.

### Rendering paths

- **On-screen:** CSS transforms on a positioned `<span>` per line
- **SVG export:** `<text>` with `transform="matrix(...)"` plus `textLength` set to the fill-rect width as a fidelity guard

### Border padding visual

When border padding > 0 and border-hairline is toggled on for the cell, render a 1px black rectangle at the inner-padding rect's edge. Toggle defaults to ON (brutalist press-sheet look).

### Empty-cell render

If the text is empty, render a single 4×4px black registration cross at the cell's center. This doubles as the "tap me" hint.

---

## §7 · BACKGROUND picker (step 05)

### Entry

The user advances via a `BACKGROUND →` affordance in the bottom-right of the canvas, or `Esc` then explicit Next.

### Layout transition

- The section grid (with all completed typography baked in) shrinks and slides to a small thumbnail in the top-left corner of the page
- The dyadic swatch (now built from the **whole bitmap**'s palette) scales up from where the per-cell picker last sat and flows into the **left half** of the page, edge-to-edge
- The **average color block** materializes on the **right half** of the page, edge-to-edge
- Bottom-left of the average pane: the average hex in big bold sans (clamp(40px, 6vw, 84px)) with a Sligoil mono subtitle "GLOBAL SWATCH AVERAGE" below it
- The hex stamp uses `mix-blend-mode: difference` so it stays legible against any average color
- Crop-mark ticks appear in the page's four corners

### Interaction

- Click any swatch cell or the average block → the corner thumbnail's background updates live
- Selected swatch ringed 1px black
- The average block has an implicit always-selected outline if no swatch is picked

### Animation back

Clicking the corner thumbnail returns to COMPOSE — the picker collapses back into per-cell scale, the section grid returns to working size. Nothing is destroyed.

### Footer caption

`TYP0GLYPHIE · STEP 05 / 06 · BACKGROUND` in Sligoil mono caps, hairline 1px above it.

---

## §8 · EXPORT (step 06)

Two buttons: **PNG** and **SVG**.

Both render the **typography-only composition** on the chosen background. The image, the mosaic, and the UI chrome are all scaffolding — they do not appear in the export.

### Dimensions

Default: match the warped-image canvas dimensions.
User can pick: 1× (default), 2×, or a custom W×H with locked aspect.

### PNG path

- Offscreen `<canvas>` at chosen dimensions, internally rendered at 2× then downsampled for crisp edges
- Background `<rect>` filled with the chosen color
- For each cell: `ctx.save()`, apply the §6 scale transform, `ctx.fillText`, `ctx.restore()`
- `canvas.toBlob('image/png')` → trigger download

### SVG path

- `<svg>` root sized to chosen export dimensions
- `<defs><style>` block with base64-embedded `@font-face` rules for every font referenced in the composition (including any user-uploaded TTF/OTF blobs)
- `<rect>` for the background, fill = chosen color
- Optional `<rect>` array for the section grid as 1px black hairlines (toggleable at export)
- One `<text>` per cell with `transform="matrix(...)"` encoding the per-line scaleX/Y, plus `textLength` = the fill-rect width
- File metadata: `<title>` with project name, `<desc>` with `Made with typ0glyphie · {ISO date}`

### Naming

`typ0glyphie-{YYYYMMDD-HHMMSS}.{png|svg}`

### Export-step UI

A small mono caption block: `EXPORT · 2400×1800 · PNG` styled as a printer's job ticket. A "DOWNLOAD" button in sharp black at the bottom.

---

## §9 · Designer-precision readouts

The toy is playful, but every surface that hides info from a designer gets a quiet readout in Sligoil. Always visible, never modal:

- **Transform step:** bottom strip `SCALE 100.0% · ROT 0.0° · WARP ON · 16 PTS`; press `I` to toggle into editable numeric inputs
- **Sections step:** placed lines display `V 0.382` / `H 0.671`; click the label to type an exact value
- **Compose step:** focused cell's header `CELL 2,1 · 412×280PX · 1.47:1 · STRETCH 0.83/1.12 · FONT SLIGOIL MICRO MED 240PT`
- **Color picker:** every swatch shows its hex on hover in a fixed tooltip slot below the panel (never overlays the swatch)
- **Background step:** the chosen color's hex appears at export-ready size
- **Export step:** dimensions, DPI assumption (72 for SVG, choosable for PNG), expected file size estimate

**Undo/redo:** `⌘Z` / `⌘⇧Z` global, stack of 50 steps, persisted to localStorage. Keyboard only — no UI button — to keep chrome minimal.

**Grid info toggle:** `G` overlays section line percentages and per-cell dimensions on the canvas. Off by default. The toy reveals its skeleton on demand.

---

## §10 · Persistence

**Zustand with `persist` middleware** backed by:

- **localStorage** for the small project state: transform parameters, section line positions, per-cell text + font + color + padding + k-value, selected background, current step, font selection metadata
- **IndexedDB** for blobs: source image, post-transform rasterized bitmap, user-uploaded font binaries (so refresh doesn't re-upload)

**Single project at a time** — opening a new image silently overwrites. Explicit "CLEAR" affordance on the UPLOAD screen when an existing project is in storage.

**Schema versioning:** root field `version: 1`; future migrations can hook in by version number. No need to design v2 yet.

**Transient state NOT persisted:** focused cell, hover state, animation progress. On refresh you land at the same step with the same data but a clean focus state.

---

## §11 · Curated font set

Twelve free fonts bundled in `public/fonts/`, spanning display, sans, serif, mono, and pixel:

1. **Sligoil Micro Medium** (pixel; also the UI font)
2. **Space Grotesk** (sans, geometric)
3. **Archivo Black** (display sans, ultra bold)
4. **Syne** (display sans, eccentric)
5. **Pixelify Sans** (pixel display)
6. **IBM Plex Mono** (mono)
7. **JetBrains Mono** (mono, alt)
8. **Fraunces** (display serif, expressive)
9. **DM Serif Display** (serif, sharp)
10. **Bebas Neue** (condensed sans, classic poster)
11. **Big Shoulders Display** (compressed display)
12. **Redaction** (degraded serif; bridges to grunge/brutalist)

**Plus** user upload: drag a TTF/OTF onto the font dropdown to register it via `FontFace.load()` and persist the binary to IndexedDB. Subsequent sessions pick it back up automatically. Uploaded fonts are listed under a "YOUR FONTS" section of the dropdown.

---

## §12 · Module breakdown

```
src/
  app/
    App.tsx                       # top-level state machine, step orchestration
    steps/
      UploadStep.tsx
      TransformStep.tsx           # PixiJS stage + tool sidebar
      SectionsStep.tsx            # cursor-direction gesture + axis indicator
      ComposeStep.tsx             # focused cell + picker panel
      BackgroundStep.tsx          # global picker layout
      ExportStep.tsx              # PNG + SVG output UI
  components/
    LeafAxisIndicator.tsx         # the abstracted V/H mechanism
    DyadicSwatch.tsx              # the swatch tile component (Framer Motion layoutId)
    AverageBlock.tsx              # average color pane w/ difference-blend stamp
    CellTextRenderer.tsx          # the §6 squeeze-fill renderer
    CropMarks.tsx                 # the press-sheet corner ornaments
    MonoLabel.tsx                 # Sligoil mono caps text wrapper
    FontPicker.tsx                # curated 12 + upload
    PaddingSlider.tsx
    KSlider.tsx                   # k-means k count
    ReadoutStrip.tsx              # the designer-readout caption blocks
  lib/
    palette.ts                    # k-means / median-cut color extraction
    dyadic-layout.ts              # §5 algorithm
    typography-fit.ts             # §6 algorithm
    cursor-axis-detector.ts       # §3 entry-direction state machine
    mesh-warp.ts                  # PixiJS Mesh helpers
    image-io.ts                   # image load + raster pipeline
    font-io.ts                    # FontFace API + IndexedDB store
    export-svg.ts                 # §8 SVG builder
    export-png.ts                 # §8 PNG canvas writer
    undo-stack.ts                 # global undo/redo
  state/
    store.ts                      # Zustand store, persist middleware
    types.ts                      # shared types
  styles/
    tokens.css                    # spacing, sligoil binding, hairline color
    global.css
public/
  fonts/                          # Sligoil + the 12 curated free fonts
```

Each `lib/*` is pure & unit-testable (no React imports). Step files are thin orchestrators composing `lib` + `components`.

---

## §13 · Testing strategy

**Unit (Vitest)** on every `lib/*` module — pure functions are easy to assert:
- `dyadic-layout`: input weights → output rects sum to unit area exactly; smallest rect ≥ `MIN_AREA`; deterministic for fixed input
- `typography-fit`: scale math produces correctly-filled rects for known inputs; multi-line stacking correct; edge cases (1 char, 1000 chars, blank, all whitespace)
- `palette`: k-means converges; output count == k; deterministic given a seed
- `cursor-axis-detector`: state machine transitions correctly across all edge crossings, including the corner-tie case
- `export-svg`: snapshot tests of generated SVG against known compositions

**Visual regression (Playwright + screenshots):** one happy-path test per step, comparing against baselines. Catches accidental brutalist-aesthetic drift (a stray shadow, an inadvertent rounded corner).

**Interaction tests (Playwright):**
- Cursor-entry-direction gesture (move mouse from top into canvas → vertical guide appears; cross to left edge → still vertical until exit; exit and re-enter from left → horizontal guide)
- Tap-to-summon focus flow with picker panel morph
- Full upload → export run on a fixture image

**No mocking the canvas** — tests render to real `<canvas>` and verify pixel outputs at known positions.

---

## §14 · Out of scope

To keep the spec focused, these are explicitly excluded:

- Multi-project library or project list (single project, single workspace)
- Cloud sync, accounts, or auth
- Real-time collaboration
- Mobile-optimized layout (touch works as a fallback; not the target)
- Animation export (output is a still composition)
- Print / CMYK color management (sRGB only)
- Color contrast / accessibility warnings — by design, the user is making a graphic, not a UI
- Plugin / extension system
- AI features (generative colors, AI text suggestions, etc.)

---

## Build order (rough)

1. Project scaffold + Sligoil + tokens + crop-mark ornament + base layout
2. `lib/palette` + `lib/dyadic-layout` with unit tests (no UI yet)
3. `lib/typography-fit` with unit tests
4. `lib/cursor-axis-detector` with unit tests
5. UPLOAD step + Zustand store + persistence
6. TRANSFORM step (start without warp, then perspective, then mesh warp)
7. SECTIONS step
8. COMPOSE step (this is the biggest single chunk — the picker panel, the focus animation, live render)
9. BACKGROUND step
10. EXPORT step (PNG first, SVG second)
11. Designer readouts pass — add the readout strips and `G` / `I` keyboard toggles to every step
12. Undo/redo wired across steps
13. User font upload + IndexedDB persistence
14. Visual regression baselines + happy-path Playwright tests
15. Polish pass — easing curves, hover scale-to-1.18, exit/enter timings
