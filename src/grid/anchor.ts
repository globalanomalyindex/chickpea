import { mulberry32, pick, randInt, type Rng } from './prng'
import type { Axis, Grid, Guide, Module, RatioRef } from './types'
import { largestIndex } from './generators/_subdivide'

/** A human bisection cut, normalized 0..1 on its axis (`v` cuts along x, `h` along y). */
export interface Cut {
  axis: Axis
  pos: number
}

/**
 * Ratio-correct cut positions the human cuts snap to: the half, the thirds, the golden
 * sections (0.382 / 0.618), the quarters, the √5 sections (0.236 / 0.764) and the fifths.
 * These are the only positions an anchor guide may land on, so every committed cut is
 * provably one of the design ratios.
 */
export const RATIO_POSITIONS = [
  0.5, 1 / 3, 2 / 3, 0.382, 0.618, 0.25, 0.75, 0.236, 0.764, 0.2, 0.8,
  // added for more module variety: sixths, eighths, and the √2-rectangle sections
  1 / 6, 5 / 6, 0.125, 0.375, 0.625, 0.875, 1 - 1 / Math.SQRT2, 1 / Math.SQRT2,
]

/** Nearest ratio-correct position to a rough human cut. */
export function snapToRatio(pos: number): number {
  let best = RATIO_POSITIONS[0]
  let bestD = Infinity
  for (const r of RATIO_POSITIONS) {
    const d = Math.abs(pos - r)
    if (d < bestD) {
      bestD = d
      best = r
    }
  }
  return best
}

/** Ratio positions used for the seed-varied in-region subdivisions. */
const SPLIT_RATIOS = [0.5, 0.382, 0.618, 1 / 3, 2 / 3]
const EPS = 1e-6

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS
}

function addUnique(positions: number[], pos: number) {
  if (pos <= EPS || pos >= 1 - EPS) return
  if (!positions.some((p) => near(p, pos))) positions.push(pos)
}

/**
 * Turn human bisections into a snapped, valid, seed-varied grid.
 *
 * 1. Snap every cut to its nearest ratio-correct position; collect the unique v/h anchors.
 * 2. Build the base lattice — the cross-product of the snapped v-cuts (x boundaries) and
 *    h-cuts (y boundaries). This already tiles the unit square with no gaps/overlaps.
 * 3. Seed-vary: split a seed-chosen subset of the lattice cells further at ratio positions
 *    (the same area-weighted recursive subdivision the `recursive` generator uses), so each
 *    seed yields different interior structure while the committed anchors stay put.
 *
 * The returned guides always include the snapped anchors, so `checkBounds`/`checkTiling`
 * hold for every seed and the human intent is preserved exactly.
 */
export function buildAnchoredGrid(cuts: Cut[], seed: number, aspect = 1): Grid {
  const rng: Rng = mulberry32(seed)

  // 1. snapped, de-duplicated anchor positions per axis
  const vAnchors: number[] = []
  const hAnchors: number[] = []
  for (const c of cuts) {
    const snapped = snapToRatio(c.pos)
    if (c.axis === 'v') addUnique(vAnchors, snapped)
    else addUnique(hAnchors, snapped)
  }
  vAnchors.sort((a, b) => a - b)
  hAnchors.sort((a, b) => a - b)

  // 2. base lattice from the anchor boundaries
  const xs = [0, ...vAnchors, 1]
  const ys = [0, ...hAnchors, 1]
  let modules: Module[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      modules.push({ x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] })
    }
  }

  // anchor guides — always present, regardless of seed
  const guides: Guide[] = [
    ...vAnchors.map((pos) => ({ axis: 'v' as Axis, pos })),
    ...hAnchors.map((pos) => ({ axis: 'h' as Axis, pos })),
  ]

  // 3. seed-varied interior subdivision (area-weighted, ratio-position splits). The extra
  // splits live strictly *inside* lattice cells, so the anchor boundaries are never moved.
  const baseCells = modules.length
  const extraSplits = randInt(rng, 2, 5)
  const target = baseCells + extraSplits
  while (modules.length < target) {
    const idx = largestIndex(modules)
    const m = modules[idx]
    const vertical = rng() < 0.5
    const r = pick(rng, SPLIT_RATIOS)
    let a: Module
    let b: Module
    if (vertical) {
      const cut = m.x + m.w * r
      a = { x: m.x, y: m.y, w: m.w * r, h: m.h }
      b = { x: cut, y: m.y, w: m.w * (1 - r), h: m.h }
    } else {
      const cut = m.y + m.h * r
      a = { x: m.x, y: m.y, w: m.w, h: m.h * r }
      b = { x: m.x, y: cut, w: m.w, h: m.h * (1 - r) }
    }
    modules.splice(idx, 1, a, b)
  }

  const ratios: RatioRef[] = [
    ...vAnchors.map((pos) => ({ name: ratioName(pos), value: pos })),
    ...hAnchors.map((pos) => ({ name: ratioName(pos), value: pos })),
  ]
  if (ratios.length === 0) ratios.push({ name: '½', value: 0.5 })

  return {
    id: `anchored-${seed}`,
    seed,
    generator: 'recursive',
    params: { kind: 'recursive', targetModules: target, splitRatios: SPLIT_RATIOS, vBias: 0.5 },
    aspect,
    guides,
    modules,
    ratios,
    meta: {
      anchored: true,
      anchors: { v: vAnchors, h: hAnchors },
      strategy: 'human cuts snapped to ratios, interior seed-varied',
    },
  }
}

/**
 * A readable label for a snapped cut *position* (for reveal annotations).
 *
 * The annotation prints `name value.toFixed(3)`, where `value` is the position itself
 * (e.g. 0.618), so the name must denote that same position — not the irrational ratio the
 * section is *derived* from. We therefore label each snap point by the fraction or section
 * it lands on: "1/φ 0.618" (the major golden section, 1/φ ≈ 0.618) is truthful, whereas
 * "φ 0.618" would not be (φ ≈ 1.618). Symmetric points get the complementary fraction so
 * the label and number always agree.
 */
export function ratioName(pos: number): string {
  if (near(pos, 0.5)) return '½'
  if (near(pos, 1 / 3)) return '⅓'
  if (near(pos, 2 / 3)) return '⅔'
  if (near(pos, 0.382)) return '1−1/φ' // minor golden section ≈ 0.382
  if (near(pos, 0.618)) return '1/φ' // major golden section ≈ 0.618
  if (near(pos, 0.25)) return '¼'
  if (near(pos, 0.75)) return '¾'
  if (near(pos, 0.236)) return '√5−2' // ≈ 0.236
  if (near(pos, 0.764)) return '3−√5' // complement of √5−2, ≈ 0.764
  if (near(pos, 0.2)) return '⅕'
  if (near(pos, 0.8)) return '⅘'
  if (near(pos, 1 / 6)) return '⅙'
  if (near(pos, 5 / 6)) return '⅚'
  if (near(pos, 0.125)) return '⅛'
  if (near(pos, 0.375)) return '⅜'
  if (near(pos, 0.625)) return '⅝'
  if (near(pos, 0.875)) return '⅞'
  if (near(pos, 1 - 1 / Math.SQRT2)) return '1−1/√2' // ≈ 0.293, the √2-rectangle section
  if (near(pos, 1 / Math.SQRT2)) return '1/√2' // ≈ 0.707
  return pos.toFixed(3)
}
