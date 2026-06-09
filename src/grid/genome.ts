/**
 * The procedural grid genome — the grid analog of palette/generator.ts.
 *
 * There are no named "kinds" and no loaded templates. A grid is the CHARACTER of a guillotine
 * slice-tree: a handful of continuous fields + a coherent cut-ratio "voice", sampled from wide
 * distributions, that `genomeToGrid` expands into a concrete tiling of the unit square. The three
 * old generators survive only as REGIONS of this one space:
 *   - recursive subdivision  ≈ binary splits, recurse-largest, organic
 *   - golden whirl (nature)  ≈ binary golden splits, alternating axis
 *   - modular lattice        ≈ a stamped, aligned C×R grid
 * …and the hybrids between them (golden lattices, broken lattices, stripe fields) are the
 * never-before-seen grids the mandate demands. Styles EMERGE from where a seed lands; none is named.
 *
 * Perfect tiling is structural (see tree.ts): every cut goes through `splitCell`, so every grid is
 * a zero-gap, in-bounds, area-1 cover BY CONSTRUCTION. The engine (engine.ts) then samples a
 * population of genomes, scores them (score.ts), and emits only the champion — so quality is a
 * property of the OUTPUT, not the average draw.
 */

import { pick, type Rng } from './prng'
import { clamp, lerp } from '../palette/sampling'
import type { Axis, Grid, Guide, Module, RatioRef } from './types'
import { type Cell, type CutRef, cellToModule, splitCell } from './tree'
import { snapToRatio, ratioName } from './anchor'

// ---- dials (the only studio controls; bias the sampler, never break the guarantees) ----

export interface Dials {
  complexity: number // 0..1 — sparse → intricate
  tension: number // 0..1 — calm/centered → dynamic/focal asymmetry
  rhythm: number // 0..1 — organic/free → periodic/lattice
}
export const DEFAULT_DIALS: Dials = { complexity: 0.5, tension: 0.5, rhythm: 0.5 }

// ---- structural floors (also what keeps cells legible) ----

const MIN_CELL = 0.05 // a cut never produces a slab narrower than this fraction of the unit square
const MAX_ARITY = 5 // cap on a single band's child count (lower → fewer thin "barcode" column clusters)

/**
 * Coherent cut-ratio VOICES — each a small set of canon positions drawn from RATIO_POSITIONS, so
 * every cut a genome makes lands on a recognizable proportion and every label is truthful. Split
 * into "calm" (symmetric, restful) and "dynamic" (asymmetric, tense) so the Tension dial can lean.
 * (The √2 voice the design panel floated was dropped: 0.4142 is not in RATIO_POSITIONS, so ratioName
 * couldn't label it truthfully — coherence beats one extra voice.)
 */
const VOICES: Record<string, number[]> = {
  halves: [0.5],
  thirds: [1 / 3, 2 / 3],
  quarters: [0.25, 0.5, 0.75],
  golden: [0.382, 0.618],
  fifths: [0.2, 0.4, 0.6, 0.8],
  root5: [0.236, 0.764],
}
const CALM_VOICES: number[][] = [VOICES.halves, VOICES.thirds, VOICES.quarters]
const DYNAMIC_VOICES: number[][] = [VOICES.golden, VOICES.fifths, VOICES.root5]

export interface GridGenome {
  targetLeaves: number // desired module count — the universal complexity knob
  depthBias: number // 0..1 — prefer shallow/wide (0) vs deep/nested (1) growth
  recurseExponent: number // 0.4..3 — split-by-area weight: >1 recurse-largest (balanced), <1 recurse-smallest (filigree)
  voice: number[] // the coherent ratio family every non-uniform cut draws from
  primaryRatio: number // the voice member coherent genomes reuse so siblings rhyme
  ratioCoherence: number // 0..1 — P(reuse primaryRatio) vs free draw within the voice
  axisBias: number // 0.05..0.95 — P(a fresh split is vertical)
  alternation: number // 0..1 — P(a child flips axis vs its parent) — 1 = strict whirl
  axisCoupling: number // 0..1 — P(override axis to cut the LONGER side) — anti-sliver, squares cells
  arityLambda: number // 0..3 — mean extra children per band (Poisson) — the binary↔lattice slider
  bandUniformity: number // 0..1 — P(a k>2 band is born with EVEN fractions i/k)
  regularity: number // 0..1 — P(the grid is a stamped aligned lattice) + shared-ratio pressure
  marginFrac: number // 0..0.08 — outer poster margin (render-time inset; area preserved)
  gutterFrac: number // 0..0.03 — inter-cell gutter (render-time inset; area preserved)
}

// ---- sampling ----

const tri = (rng: Rng): number => (rng() - rng()) // triangular on [-1,1], peak 0

function sampleVoice(rng: Rng, tension: number): number[] {
  const dynamic = rng() < lerp(0.3, 0.85, tension)
  const pool = dynamic ? DYNAMIC_VOICES : CALM_VOICES
  let voice = [...pick(rng, pool)]
  if (rng() < 0.3) {
    // eclectic: merge a second voice → a mixed but still-canon family
    const other = pick(rng, dynamic ? DYNAMIC_VOICES : CALM_VOICES)
    voice = Array.from(new Set([...voice, ...other])).sort((a, b) => a - b)
  }
  return voice
}

/** Draw a fresh genome. `dials` shift the means of the distributions; every field is still a wide
 * draw, so each seed varies wildly even at a fixed dial position, and at default dials the space
 * spans every style. */
export function sampleGenome(rng: Rng, dials: Dials = DEFAULT_DIALS): GridGenome {
  const { complexity: cx, tension: tn, rhythm: rh } = dials

  const lo = lerp(3, 7, cx * 0.5)
  const hi = lerp(8, 28, cx)
  const targetLeaves = Math.round(Math.exp(lerp(Math.log(lo), Math.log(hi), rng())))

  const voice = sampleVoice(rng, tn)

  return {
    targetLeaves: clamp(targetLeaves, 3, 28),
    depthBias: clamp(rng() + (cx - 0.5) * 0.3, 0, 1),
    recurseExponent: clamp(lerp(0.4, 3.0, rng()) * Math.exp((tn - 0.5) * 0.8), 0.4, 3.0),
    voice,
    primaryRatio: pick(rng, voice),
    ratioCoherence: clamp(Math.pow(rng(), 0.7) + (rh - 0.5) * 0.3, 0, 1),
    axisBias: clamp(0.5 + tri(rng) * 0.5, 0.05, 0.95),
    alternation: clamp(rng() - (rh - 0.5) * 0.4, 0, 1),
    axisCoupling: rng() < 0.5 ? 0 : lerp(0, 1, rng()),
    arityLambda: clamp((rng() < 0.45 ? lerp(0, 0.3, rng()) : lerp(0.3, 2.5, rng())) + (rh - 0.5) * 1.4, 0, 3),
    bandUniformity: clamp(rng() + (rh - 0.5) * 0.5, 0, 1),
    regularity: clamp((rng() < 0.35 ? lerp(0.55, 1, rng()) : lerp(0, 0.55, rng())) + (rh - 0.5) * 0.7, 0, 1),
    marginFrac: rng() < 0.4 ? lerp(0.02, 0.08, rng()) : 0,
    gutterFrac: rng() < lerp(0.15, 0.7, rh) ? lerp(0.004, 0.03, rng()) : 0,
  }
}

// ---- mutation (hill-climb) ----

/** Nudge a genome for the hill-climb: mostly small continuous moves, with a 25% structural jump that
 * hops between style regions (swap the whole voice, flip binary↔band, flip organic↔lattice, re-roll
 * axis character) — the moves drift can't reach, so nearby climbs don't look samey. Pure given rng. */
export function mutateGenome(g: GridGenome, rng: Rng, amt = 1): GridGenome {
  const j = (a: number): number => (rng() * 2 - 1) * a * amt
  const next: GridGenome = {
    ...g,
    targetLeaves: clamp(Math.round(g.targetLeaves + j(3)), 3, 28),
    depthBias: clamp(g.depthBias + j(0.15), 0, 1),
    recurseExponent: clamp(g.recurseExponent * Math.exp(j(0.3)), 0.4, 3.0), // log-space (scale param)
    ratioCoherence: clamp(g.ratioCoherence + j(0.15), 0, 1),
    axisBias: clamp(g.axisBias + j(0.12), 0.05, 0.95),
    alternation: clamp(g.alternation + j(0.15), 0, 1),
    axisCoupling: clamp(g.axisCoupling + j(0.15), 0, 1),
    arityLambda: clamp(g.arityLambda + j(0.4), 0, 3),
    bandUniformity: clamp(g.bandUniformity + j(0.15), 0, 1),
    regularity: clamp(g.regularity + j(0.15), 0, 1),
    marginFrac: clamp(g.marginFrac + j(0.015), 0, 0.08),
    gutterFrac: clamp(g.gutterFrac + j(0.006), 0, 0.03),
  }
  if (rng() < 0.25) {
    const k = Math.floor(rng() * 4)
    if (k === 0) {
      next.voice = sampleVoice(rng, 0.5)
      next.primaryRatio = pick(rng, next.voice)
    } else if (k === 1) {
      next.arityLambda = rng() < 0.5 ? lerp(0, 0.3, rng()) : lerp(0.3, 2.5, rng())
    } else if (k === 2) {
      next.regularity = rng() < 0.5 ? lerp(0, 0.4, rng()) : lerp(0.6, 1, rng())
    } else {
      next.axisBias = clamp(0.5 + tri(rng) * 0.5, 0.05, 0.95)
    }
  }
  if (!next.voice.includes(next.primaryRatio)) next.primaryRatio = next.voice[0]
  return next
}

// ---- render: genome → Grid (every cut via splitCell, so the tiling is exact by construction) ----

const splittable = (c: Cell, axis: Axis): boolean =>
  (axis === 'v' ? c.x1 - c.x0 : c.y1 - c.y0) >= 2 * MIN_CELL
const canSplit = (c: Cell): boolean => splittable(c, 'v') || splittable(c, 'h')

function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L && k < 32)
  return k - 1
}

/** A single binary ratio from the voice — the genome's primary (with prob ratioCoherence, so siblings
 * rhyme) or a free voice member. */
function pickRatio(rng: Rng, g: GridGenome): number {
  return rng() < g.ratioCoherence ? g.primaryRatio : pick(rng, g.voice)
}

/** Place `n` interior cut fractions in (0,1) by repeatedly cutting the largest current gap at a voice
 * ratio — the uneven "ledger" band. Rejects cuts that would make a slab smaller than MIN_CELL of the
 * whole, so non-uniform bands stay legible. */
function voiceSplits(rng: Rng, g: GridGenome, n: number): number[] {
  const bounds = [0, 1]
  for (let i = 0; i < n; i++) {
    let placed = false
    for (let tries = 0; tries < 8 && !placed; tries++) {
      let bi = 0
      let best = -1
      for (let j = 0; j < bounds.length - 1; j++) {
        const gap = bounds[j + 1] - bounds[j]
        if (gap > best) {
          best = gap
          bi = j
        }
      }
      const lo = bounds[bi]
      const hi = bounds[bi + 1]
      const c = lo + (hi - lo) * pickRatio(rng, g)
      if (c - lo >= MIN_CELL && hi - c >= MIN_CELL) {
        bounds.splice(bi + 1, 0, c)
        placed = true
      }
    }
    if (!placed) break
  }
  return bounds.slice(1, -1)
}

/** The interior fractions for splitting a cell into k slabs along an axis. */
function pickFractions(rng: Rng, g: GridGenome, k: number, uniform: boolean): number[] {
  if (k === 2) return [pickRatio(rng, g)]
  if (uniform) return Array.from({ length: k - 1 }, (_, i) => (i + 1) / k)
  const fr = voiceSplits(rng, g, k - 1)
  return fr.length >= 1 ? fr : Array.from({ length: k - 1 }, (_, i) => (i + 1) / k)
}

/** Choose the split axis for a cell from the genome's axis character, falling back to whichever axis
 * has room. Returns null if the cell can't be split at all. */
function chooseAxis(rng: Rng, c: Cell, g: GridGenome): Axis | null {
  let vertical = rng() < g.axisBias
  if (c.axis && rng() < g.alternation) vertical = c.axis !== 'v' // flip relative to parent
  if (rng() < g.axisCoupling) vertical = c.x1 - c.x0 > c.y1 - c.y0 // cut the longer side
  let axis: Axis = vertical ? 'v' : 'h'
  if (!splittable(c, axis)) axis = axis === 'v' ? 'h' : 'v'
  return splittable(c, axis) ? axis : null
}

/** Arity for a band on `axis`, capped so no child falls below MIN_CELL. */
function pickArity(rng: Rng, c: Cell, g: GridGenome, axis: Axis): number {
  const span = axis === 'v' ? c.x1 - c.x0 : c.y1 - c.y0
  const maxK = Math.max(2, Math.floor(span / MIN_CELL))
  return Math.min(2 + poisson(rng, g.arityLambda), MAX_ARITY, maxK)
}

/** Lay a stamped, aligned C×R lattice into `leaves` (replacing the single root). Columns are cut once;
 * every column is then cut at the SAME row fractions, so rows align and the shared edges are
 * bit-identical. Returns when `leaves` holds the C×R cells. */
function layLattice(root: Cell, g: GridGenome, rng: Rng, count: number): { leaves: Cell[]; cuts: CutRef[] } {
  let C = clamp(Math.round(Math.sqrt(count)), 2, 6)
  let R = clamp(Math.round(count / C), 2, 6)
  if (rng() < 0.5) [C, R] = [R, C] // portrait/landscape variety
  const uniform = rng() < g.bandUniformity

  const colFracs = uniform ? Array.from({ length: C - 1 }, (_, i) => (i + 1) / C) : voiceSplits(rng, g, C - 1)
  const rowFracs = uniform ? Array.from({ length: R - 1 }, (_, i) => (i + 1) / R) : voiceSplits(rng, g, R - 1)

  const cols = splitCell(root, 'v', colFracs.length ? colFracs : [0.5])
  const leaves: Cell[] = []
  const cuts: CutRef[] = [...cols.cuts]
  for (const col of cols.children) {
    const rows = splitCell(col, 'h', rowFracs.length ? rowFracs : [0.5])
    leaves.push(...rows.children)
    cuts.push(...rows.cuts)
  }
  return { leaves, cuts }
}

/** Grow `leaves` by frontier expansion until it reaches `target` (or no cell can be split). Each step
 * picks a leaf weighted by area^recurseExponent and depth, splits it into a binary or n-ary band. */
function growFrontier(leaves: Cell[], cuts: CutRef[], g: GridGenome, rng: Rng, target: number): void {
  let guard = 0
  while (leaves.length < target && guard++ < 400) {
    const idxs = leaves.map((_, i) => i).filter((i) => canSplit(leaves[i]))
    if (idxs.length === 0) break
    const depthPow = lerp(-0.6, 0.9, g.depthBias)
    let total = 0
    const weights = idxs.map((i) => {
      const c = leaves[i]
      const area = (c.x1 - c.x0) * (c.y1 - c.y0)
      const w = Math.pow(area, g.recurseExponent) * Math.pow(c.depth + 1, depthPow)
      total += w
      return w
    })
    let r = rng() * total
    let pickIdx = idxs[0]
    for (let m = 0; m < idxs.length; m++) {
      r -= weights[m]
      if (r <= 0) {
        pickIdx = idxs[m]
        break
      }
    }
    const cell = leaves[pickIdx]
    const axis = chooseAxis(rng, cell, g)
    if (!axis) continue
    const span = axis === 'v' ? cell.x1 - cell.x0 : cell.y1 - cell.y0
    const k = pickArity(rng, cell, g, axis)
    const uniform = k > 2 && rng() < g.bandUniformity
    let fracs = pickFractions(rng, g, k, uniform)
    // ABSOLUTE slab-size guarantee: a voice ratio that's fine in fraction-of-parent space can still
    // carve a sub-MIN_CELL sliver out of an already-small cell. Even spacing is always safe (k is
    // capped by span/MIN_CELL), so fall back to it whenever the chosen fractions would undershoot.
    const bnds = [0, ...fracs, 1]
    const safe = bnds.every((p, i) => i === 0 || (p - bnds[i - 1]) * span >= MIN_CELL)
    if (!safe) fracs = Array.from({ length: k - 1 }, (_, i) => (i + 1) / k)
    const { children, cuts: newCuts } = splitCell(cell, axis, fracs)
    leaves.splice(pickIdx, 1, ...children)
    for (const c of newCuts) cuts.push(c)
  }
}

/** Dedupe cuts into the unique guide set (a row cut stamped across columns collapses to one guide). */
function uniqueCuts(cuts: CutRef[]): CutRef[] {
  const seen = new Set<string>()
  const out: CutRef[] = []
  for (const c of cuts) {
    const key = `${c.axis}:${c.pos.toFixed(6)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

const ASPECTS: { v: number; name: string }[] = [
  { v: 1, name: '1:1' },
  { v: 1.414, name: '√2' },
  { v: 1.5, name: '3:2' },
  { v: 1.618, name: 'φ' },
  { v: 2, name: '2:1' },
]
function aspectRef(m: Module): RatioRef {
  const a = Math.max(m.w / m.h, m.h / m.w)
  let best = ASPECTS[0]
  let bestD = Infinity
  for (const c of ASPECTS) {
    const d = Math.abs(a - c.v)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return { name: bestD < 0.06 ? best.name : 'w:h', value: a }
}

/** Build a truthful ratio readout: the distinct cut proportions used (by frequency) + the dominant
 * module's aspect. A cut's name comes from its PARENT-RELATIVE fraction snapped to a canon position,
 * so a cut at absolute 0.809 that is the 1/φ point of [0.5,1] reads "1/φ", never "0.809". */
function buildRatios(cuts: CutRef[], modules: Module[]): { ratios: RatioRef[]; distinct: number } {
  const counts = new Map<string, { value: number; count: number }>()
  for (const c of cuts) {
    const snapped = snapToRatio(c.frac)
    const onRatio = Math.abs(c.frac - snapped) < 0.012
    const name = onRatio ? ratioName(snapped) : c.frac.toFixed(3)
    const value = onRatio ? snapped : c.frac
    const e = counts.get(name)
    if (e) e.count++
    else counts.set(name, { value, count: 1 })
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1].count - a[1].count)
  const ratios: RatioRef[] = ranked.slice(0, 3).map(([name, e]) => ({ name, value: e.value }))
  const dom = modules.reduce((p, c) => (c.w * c.h > p.w * p.h ? c : p), modules[0])
  if (dom) ratios.push(aspectRef(dom))
  return { ratios, distinct: counts.size }
}

/** Expand a genome into a finished Grid. Pure given `rng`. Tiling/bounds hold by construction. */
export function genomeToGrid(g: GridGenome, seed: number, rng: Rng): Grid {
  const root: Cell = { x0: 0, x1: 1, y0: 0, y1: 1, axis: null, depth: 0 }
  let leaves: Cell[] = [root]
  let cuts: CutRef[] = []

  const lattice = rng() < g.regularity
  if (lattice) {
    const broken = rng() < 1 - g.regularity
    const baseCount = broken ? Math.max(4, Math.round(g.targetLeaves * 0.6)) : g.targetLeaves
    const laid = layLattice(root, g, rng, baseCount)
    leaves = laid.leaves
    cuts = laid.cuts
    if (broken) growFrontier(leaves, cuts, g, rng, g.targetLeaves)
  } else {
    growFrontier(leaves, cuts, g, rng, g.targetLeaves)
  }

  const uniq = uniqueCuts(cuts)
  const guides: Guide[] = uniq.map((c) => ({ axis: c.axis, pos: c.pos }))
  const modules: Module[] = leaves.map(cellToModule)
  const { ratios, distinct } = buildRatios(uniq, modules)

  return {
    id: `grid-${seed}`,
    seed,
    generator: 'recursive', // sentinel for type compat; the real character lives in meta.genome
    params: { kind: 'recursive', targetModules: modules.length, splitRatios: g.voice, vBias: g.axisBias },
    aspect: 1,
    guides,
    modules,
    ratios,
    meta: {
      genome: g,
      cuts: uniq,
      marginFrac: g.marginFrac,
      gutterFrac: g.gutterFrac,
      distinctRatios: distinct,
      lattice,
      strategy: 'unified guillotine slice-tree',
    },
  }
}
