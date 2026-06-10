import { mulberry32, pick, randInt, type Rng } from './prng'
import type { Axis, Grid, Guide, Module, RatioRef } from './types'
import { RATIO_POSITIONS, ratioName } from './ratios'
import type { Cell, CutRef } from './tree'
import { growFrontier, uniqueCuts, type GridGenome } from './genome'
import { scoreGrid } from './score'

// the canon lives in ratios.ts (shared with the generator + scorer); re-exported here so existing
// consumers of the anchor module keep working unchanged.
export { RATIO_POSITIONS, snapToRatio, ratioName } from './ratios'

/** A human bisection cut, normalized 0..1 on its axis (`v` cuts along x, `h` along y). */
export interface Cut {
  axis: Axis
  pos: number
}

/** A snapped anchor: where the guide landed, plus the truthful proportion it represents — either a
 * canon position of the whole canvas, or a canon ratio OF THE SEGMENT between two earlier anchors. */
interface Anchor {
  pos: number
  frac: number // the proportion to label (of [lo,hi])
  lo: number
  hi: number
  nested: boolean
}

/** Ratio points a NESTED snap may land on inside a segment — the proportions a designer actually
 * subdivides a region by. Smaller than the global canon so segment snaps stay unambiguous. */
const NESTED_RATIOS = [0.5, 1 / 3, 2 / 3, 0.382, 0.618, Math.SQRT2 - 1, 2 - Math.SQRT2]

const EPS = 1e-6
const near = (a: number, b: number): boolean => Math.abs(a - b) < EPS

/** A snap never moves a cut farther than this — a click with no free canon position nearby is
 * DECLINED (with feedback), not teleported to a ratio the user never aimed at. */
const SNAP_REACH = 0.07

/**
 * Snap a rough human cut against the existing same-axis anchors. Candidates come from BOTH systems:
 * the global canon positions of the whole canvas, and the canon ratios of each segment between
 * existing anchors (so a second cut can land on "the golden point of the right half" — how designers
 * really subdivide). Nearest candidate wins; on a near-tie the global read is preferred because it is
 * the simpler claim. Returns null if the cut would crowd an existing anchor or sit beyond SNAP_REACH
 * of every free canon position.
 */
function snapAgainst(pos: number, existing: number[]): Anchor | null {
  let best: Anchor | null = null
  let bestBiased = Infinity
  let bestRaw = Infinity
  const consider = (cand: Anchor, d: number, biased: number) => {
    if (existing.some((e) => Math.abs(cand.pos - e) < 0.05)) return
    if (biased < bestBiased) {
      bestBiased = biased
      bestRaw = d
      best = { ...cand }
    }
  }
  for (const r of RATIO_POSITIONS) {
    const d = Math.abs(pos - r)
    consider({ pos: r, frac: r, lo: 0, hi: 1, nested: false }, d, d)
  }
  const bounds = [0, ...existing].sort((a, b) => a - b)
  bounds.push(1)
  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i]
    const hi = bounds[i + 1]
    if (hi - lo < 0.18 || (lo === 0 && hi === 1)) continue // whole canvas is the global system
    for (const r of NESTED_RATIOS) {
      const p = lo + (hi - lo) * r
      const d = Math.abs(pos - p)
      // a nested read must be a clearly better fit than the best global one to win the tie
      consider({ pos: p, frac: r, lo, hi, nested: true }, d, d + 0.0015)
    }
  }
  return bestRaw <= SNAP_REACH ? best : null
}

/** A snapped cut for UI consumption: where the guide lands, the proportion it represents, and the
 * truthful name to show ("½", "1/φ of the segment", …). Null = the cut would crowd an existing one. */
export interface SnappedCut {
  pos: number
  frac: number
  name: string
  nested: boolean
}

/** Snap one rough cut against the existing same-axis cut positions — the SAME logic the committed
 * grid uses, exported so the bisection UI can place the line where the math will actually put it
 * (what you see is what commits) and label it truthfully at click time. */
export function snapCut(pos: number, existingSameAxis: number[]): SnappedCut | null {
  const a = snapAgainst(pos, existingSameAxis)
  if (!a || a.pos <= EPS || a.pos >= 1 - EPS) return null
  return { pos: a.pos, frac: a.frac, name: ratioName(a.frac), nested: a.nested }
}

/** The (axis-sorted, deduped) anchors for one axis, snapped in placement order so nested snaps see
 * exactly the segments the human saw when they made the cut. */
function snapAxis(cuts: Cut[], axis: Axis): Anchor[] {
  const anchors: Anchor[] = []
  for (const c of cuts) {
    if (c.axis !== axis) continue
    const a = snapAgainst(c.pos, anchors.map((x) => x.pos))
    if (!a) continue
    if (a.pos <= EPS || a.pos >= 1 - EPS) continue
    if (!anchors.some((x) => near(x.pos, a.pos))) anchors.push(a)
  }
  return anchors
}

/** The base lattice: the cross-product of anchor boundaries, built from SHARED coordinate arrays so
 * every edge two cells share is the same double (===), the same exactness the slice-tree gives. */
function anchorLattice(vA: Anchor[], hA: Anchor[]): { leaves: Cell[]; cuts: CutRef[] } {
  const xs = [0, ...vA.map((a) => a.pos).sort((a, b) => a - b), 1]
  const ys = [0, ...hA.map((a) => a.pos).sort((a, b) => a - b), 1]
  const leaves: Cell[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      leaves.push({ x0: xs[i], x1: xs[i + 1], y0: ys[j], y1: ys[j + 1], axis: null, depth: 1 })
    }
  }
  // anchor CutRefs carry the truthful proportion the human committed (global or segment-relative)
  const cuts: CutRef[] = [
    ...vA.map((a) => ({ axis: 'v' as Axis, pos: a.pos, frac: a.frac, lo: a.lo, hi: a.hi, depth: 0 })),
    ...hA.map((a) => ({ axis: 'h' as Axis, pos: a.pos, frac: a.frac, lo: a.lo, hi: a.hi, depth: 0 })),
  ]
  return { leaves, cuts }
}

/** A modest interior-growth character derived from the anchors themselves: the voice is the set of
 * proportions the human already committed (plus the core canon), so the seed-varied interior rhymes
 * with the anchors instead of fighting them. */
function interiorGenome(rng: Rng, anchorFracs: number[], aspect: number): GridGenome {
  const canon = [0.5, 0.382, 0.618]
  const voice = Array.from(new Set([...anchorFracs.filter((f) => f > 0.1 && f < 0.9), ...canon])).sort(
    (a, b) => a - b,
  )
  return {
    targetLeaves: 3, // overwritten by the caller's growth target
    depthBias: 0.35,
    recurseExponent: 1.4 + rng() * 1.0,
    voice,
    primaryRatio: pick(rng, voice),
    ratioCoherence: 0.5 + rng() * 0.4,
    axisBias: 0.35 + rng() * 0.3,
    alternation: 0.6,
    axisCoupling: 0.7,
    arityLambda: rng() < 0.6 ? 0 : 0.8,
    bandUniformity: 0.5,
    regularity: 0,
    marginFrac: 0,
    gutterFrac: 0,
    aspect,
    program: ['grow'],
    mirrorAxis: 'v',
  }
}

/**
 * Turn human bisections into a snapped, valid, seed-varied grid.
 *
 * 1. Snap every cut in placement order — to a global canon position OR a canon ratio of the segment
 *    between earlier anchors (nested snapping), whichever reads truer.
 * 2. Build the base lattice from the anchor boundaries (shared-coordinate exact).
 * 3. Seed-vary the interior on the SAME slice-tree machinery as the main engine — and like the main
 *    engine, SEARCH it: several candidate interiors are grown and scored, and only the champion is
 *    returned. Image-bisection variations clear the same quality bar as everything else.
 *
 * The returned guides always include the snapped anchors, so `checkBounds`/`checkTiling` hold for
 * every seed and the human intent is preserved exactly.
 */
export function buildAnchoredGrid(cuts: Cut[], seed: number, aspect = 1): Grid {
  const rng: Rng = mulberry32(seed)

  const vA = snapAxis(cuts, 'v')
  const hA = snapAxis(cuts, 'h')
  const anchorFracs = [...vA, ...hA].map((a) => a.frac)

  // guides that are always present, regardless of seed
  const anchorGuides: Guide[] = [
    ...vA.map((a) => ({ axis: 'v' as Axis, pos: a.pos })),
    ...hA.map((a) => ({ axis: 'h' as Axis, pos: a.pos })),
  ]

  // candidate interiors: grow K variations from the lattice, score each, keep the champion
  const K = 8
  let best: { leaves: Cell[]; cuts: CutRef[]; score: number } | null = null
  for (let i = 0; i < K; i++) {
    const { leaves, cuts: cRefs } = anchorLattice(vA, hA)
    const g = interiorGenome(rng, anchorFracs, aspect)
    const target = leaves.length + randInt(rng, 2, 6)
    growFrontier(leaves, cRefs, g, rng, target, aspect)
    const modules = leaves.map((c) => ({ x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0 }))
    const probe: Grid = {
      id: 'probe',
      seed,
      generator: 'recursive',
      params: { kind: 'recursive', targetModules: target, splitRatios: g.voice, vBias: 0.5 },
      aspect,
      guides: [],
      modules,
      ratios: [],
      meta: { cuts: cRefs },
    }
    const s = scoreGrid(probe).total
    if (!best || s > best.score) best = { leaves, cuts: cRefs, score: s }
  }
  const champion = best as NonNullable<typeof best>

  const uniq = uniqueCuts(champion.cuts)
  const modules: Module[] = champion.leaves.map((c) => ({ x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0 }))
  const guides: Guide[] = uniq.map((c) => ({ axis: c.axis, pos: c.pos }))
  for (const ag of anchorGuides) {
    if (!guides.some((gd) => gd.axis === ag.axis && near(gd.pos, ag.pos))) guides.push(ag)
  }

  // the anchors lead the truthful readout: a global anchor is named by its canvas position, a nested
  // one by the segment ratio the human actually took (its `frac`), never a misleading decimal.
  const ratios: RatioRef[] = [...vA, ...hA].map((a) => ({ name: ratioName(a.frac), value: a.frac }))
  if (ratios.length === 0) ratios.push({ name: '½', value: 0.5 })

  return {
    id: `anchored-${seed}`,
    seed,
    generator: 'recursive',
    params: {
      kind: 'recursive',
      targetModules: modules.length,
      splitRatios: NESTED_RATIOS,
      vBias: 0.5,
    },
    aspect,
    guides,
    modules,
    ratios,
    meta: {
      anchored: true,
      anchors: { v: vA.map((a) => a.pos), h: hA.map((a) => a.pos) },
      cuts: uniq,
      strategy: 'human cuts snapped to ratios (global or nested), interior seed-varied + quality-scored',
    },
  }
}
