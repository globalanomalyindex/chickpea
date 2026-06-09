/**
 * Perceptual quality score for a candidate grid — the judge that makes "always beautiful" real.
 * The engine samples many genomes and emits only a high-scoring one, so quality is a property of the
 * OUTPUT, not a hope about the average draw. Every term returns 0..1 (1 = best); the total is their
 * weighted sum, times a coherence gate and two multiplicative degeneracy tics.
 *
 * Transplanted from the palette scorer's hard-won lesson: a single feature must never be able to fool
 * several terms at once. So there are TWO roads to a high score — crisp regularity OR clear hierarchy
 * — with the muddy middle (a near-uniform grid with a few stray cuts) punished by BOTH; and every
 * degenerate grid loses on at least two orthogonal terms. Terms:
 *   aspectQuality   — cells sit near pleasing aspect ratios; slivers are caught (area-weighted)
 *   alignment       — few shared guide lines serve many edges (a real grid, not a shattered pane)
 *   ratioCoherence  — cuts land on a small coherent family of canon/even proportions
 *   whitespaceRhythm— crisp equal-cell lattice OR a deliberate big/small mix; punish the wobble between
 *   hierarchy       — a dominant module with real support (60-30-10); not one giant cell
 *   balance         — visual-weight centroid near center (or deliberately offset at high Tension)
 *   complexityMatch — effective cell count tracks the Complexity dial
 *   interest        — orientation/size/guide variety, GATED by alignment so it never pays for noise
 */

import type { Grid } from './types'
import type { CutRef } from './tree'
import { clamp, lerp } from '../palette/sampling'
import { snapToRatio } from './anchor'
import { DEFAULT_DIALS, type Dials } from './genome'

export interface ScoreBreakdown {
  total: number
  aspectQuality: number
  alignment: number
  ratioCoherence: number
  whitespaceRhythm: number
  hierarchy: number
  balance: number
  complexityMatch: number
  interest: number
}

// Weights are tuned to FLATTEN the landscape so a clean lattice and a golden recursion tie at the top
// (else a quality-maximizing selector collapses every seed onto the single highest-scoring grid). The
// lattice-favoring terms (alignment, whitespaceRhythm, complexityMatch) are restrained; the
// organic-favoring terms (hierarchy, interest) carry real weight — so each seed's best draw, lattice
// OR organic, can win, and variety survives selection.
export const SCORE_WEIGHTS = {
  aspectQuality: 0.16,
  alignment: 0.11,
  ratioCoherence: 0.13,
  whitespaceRhythm: 0.12,
  hierarchy: 0.15,
  balance: 0.09,
  complexityMatch: 0.08,
  interest: 0.16,
}

const smooth = (x: number, a: number, b: number): number => clamp((x - a) / (b - a), 0, 1)
const bell = (x: number, c: number, w: number): number => {
  const z = (x - c) / w
  return Math.exp(-(z * z))
}
const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const std = (a: number[]): number => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((v) => (v - m) * (v - m))))
}

const CANON_ASPECTS = [1, 1.414, 1.5, 1.618, 2]
const ASPECT_TOL = Math.log(1.17) // ±17% in log space

/** Closest residual of `frac` to either a canon ratio position OR an even division i/k (k≤8). Both
 * are intentional cut systems, so both count as coherent; a cut off BOTH systems is the off-grid one. */
function ratioResidual(frac: number): number {
  let r = Math.abs(frac - snapToRatio(frac))
  for (let k = 2; k <= 8; k++) {
    for (let j = 1; j < k; j++) r = Math.min(r, Math.abs(frac - j / k))
  }
  return r
}

export function scoreGrid(grid: Grid, dials: Dials = DEFAULT_DIALS): ScoreBreakdown {
  const mods = grid.modules
  const n = mods.length
  if (n < 2) {
    return { total: 0.5, aspectQuality: 0.5, alignment: 0.5, ratioCoherence: 0.5, whitespaceRhythm: 0.5, hierarchy: 0.5, balance: 0.5, complexityMatch: 0.5, interest: 0.5 }
  }
  const cuts = (grid.meta?.cuts as CutRef[] | undefined) ?? []
  const areas = mods.map((m) => m.w * m.h) // sum ≈ 1
  const areaHerf = areas.reduce((s, a) => s + a * a, 0)
  const effCells = 1 / areaHerf

  // aspectQuality — area-weighted proximity of each cell's folded aspect to a canon ratio; slivers (the
  // most common ugliness) collapse it because the weight is area and the >5:1 cliff zeroes them out.
  // Judged in RENDERED space: a module's on-screen aspect is its unit aspect times the canvas aspect,
  // so a non-square composition is scored by how its cells actually look, not their unit-square shape.
  const aspect = grid.aspect && grid.aspect > 0 ? grid.aspect : 1
  let aspectQuality = 0
  for (const m of mods) {
    const k = (m.w / m.h) * aspect
    const R = Math.max(k, 1 / k)
    let d = Infinity
    for (const c of CANON_ASPECTS) d = Math.min(d, Math.abs(Math.log(R / c)))
    let q = bell(d, 0, ASPECT_TOL)
    if (R > 5) q = 0 // anything past 5:1 reads as a sliver, not a cell
    else if (R > 4) q *= 5 - R // taper 4:1 → 5:1
    aspectQuality += (m.w * m.h) * q
  }

  // alignment — structural economy: how many interior edges share each distinct cut line. A real grid
  // reuses a few guides for many edges; a shattered pane has a unique cut per edge.
  const edgeStats = (coords: number[]): { total: number; distinct: number } => {
    const interior = coords.filter((v) => v > 1e-6 && v < 1 - 1e-6).sort((a, b) => a - b)
    let distinct = 0
    let last = -1
    for (const v of interior) {
      if (distinct === 0 || v - last > 0.012) {
        distinct++
        last = v
      }
    }
    return { total: interior.length, distinct }
  }
  const xs = edgeStats(mods.flatMap((m) => [m.x, m.x + m.w]))
  const ys = edgeStats(mods.flatMap((m) => [m.y, m.y + m.h]))
  const distinctCuts = xs.distinct + ys.distinct
  const totalEdges = xs.total + ys.total
  const edgeReuse = distinctCuts > 0 ? totalEdges / distinctCuts : 1
  const alignment = smooth(edgeReuse, 1.15, 2.4) * (1 - smooth(distinctCuts, n + 2, n * 2.2))

  // ratioCoherence — cuts (parent-relative) land on a small coherent family of canon/even proportions.
  let snapQuality = 1
  let familySize = 1
  if (cuts.length > 0) {
    snapQuality = mean(cuts.map((c) => clamp(1 - ratioResidual(c.frac) / 0.02, 0, 1)))
    const bins = new Map<number, number>()
    for (const c of cuts) {
      const key = Math.round(snapToRatio(c.frac) * 1000)
      bins.set(key, (bins.get(key) ?? 0) + 1)
    }
    let herf = 0
    for (const v of bins.values()) herf += (v / cuts.length) ** 2
    familySize = herf > 0 ? 1 / herf : 1
  }
  const ratioCoherence = snapQuality * clamp(1 - (familySize - 3) * 0.18, 0.4, 1)

  // whitespaceRhythm — bimodal "tight OR evenly-spaced; punish the muddy middle": a crisp equal-cell
  // lattice (cvA→0) OR a deliberate big/small mix (cvA~0.95); a bumped near-uniform grid falls in both
  // valleys. Uniformity is NEVER globally penalized — crisp rewards it.
  const cvA = mean(areas) > 1e-9 ? std(areas) / mean(areas) : 0
  const crisp = 1 - smooth(cvA, 0.04, 0.16)
  const rhythmic = bell(cvA, 0.7, 0.6) // peak at a typical good big/small mix, not an extreme one
  const whitespaceRhythm = Math.max(crisp, rhythmic)

  // hierarchy — a dominant module owning 28–62% WITH a real supporter (60-30-10). Damped by area
  // concentration so a single giant cell does not masquerade as hierarchy.
  const aDesc = [...areas].sort((a, b) => b - a)
  const dominance = smooth(aDesc[0], 0.28, 0.62)
  const support = smooth((aDesc[1] ?? 0) / aDesc[0], 0.22, 0.62)
  const giantDamp = 1 - smooth(areaHerf, 0.5, 0.78)
  const hierarchy = dominance * (0.45 + 0.55 * support) * giantDamp

  // balance — area-weighted centroid near center, or deliberately offset as Tension rises.
  let cx = 0
  let cy = 0
  for (const m of mods) {
    cx += m.w * m.h * (m.x + m.w / 2)
    cy += m.w * m.h * (m.y + m.h / 2)
  }
  const offset = Math.hypot(cx - 0.5, cy - 0.5)
  const targetOff = 0.04 + 0.2 * dials.tension
  const balance = bell(offset, targetOff, 0.22)

  // complexityMatch — effective cell count tracks the Complexity dial (effective, so slivers can't pad).
  const targetCells = lerp(3, 22, dials.complexity)
  const complexityMatch = bell(Math.log(effCells), Math.log(targetCells), 0.6)

  // interest — orientation/size/guide variety, GATED by alignment so it never rewards noise.
  const wide = mods.filter((m) => m.w > m.h).length / n
  const orientMix = 1 - Math.abs(2 * wide - 1)
  const sizeSpan = clamp(std(areas.map((a) => Math.log(a))) / 0.9, 0, 1)
  const guideRich = smooth(distinctCuts, 1.5, n * 0.9)
  // GATED BY ratioCoherence, not alignment: variety within a coherent ratio scheme is interesting;
  // gating by alignment (as the palette gated by harmony) would wrongly zero out organic grids — the
  // very ones that HAVE variety — and is what collapsed every seed onto the same clean lattice.
  const interest = (0.4 * orientMix + 0.35 * sizeSpan + 0.25 * guideRich) * smooth(ratioCoherence, 0.35, 0.7)

  const W = SCORE_WEIGHTS
  const weighted =
    W.aspectQuality * aspectQuality +
    W.alignment * alignment +
    W.ratioCoherence * ratioCoherence +
    W.whitespaceRhythm * whitespaceRhythm +
    W.hierarchy * hierarchy +
    W.balance * balance +
    W.complexityMatch * complexityMatch +
    W.interest * interest

  // coherence gate: a grid earns structural coherence via EITHER the lattice road (edge alignment) OR
  // the organic road (clear hierarchy) — a golden whirl is coherent without sharing guide lines, so
  // requiring alignment (as a first cut did) wrongly crushed it. The off-grid-cuts factor (low
  // ratioCoherence) still bites both. An incoherent shattered pane fails both roads AND ratioCoherence.
  const structure = Math.max(smooth(alignment, 0.3, 0.62), smooth(hierarchy, 0.2, 0.5))
  const coherenceGate = (0.7 + 0.3 * structure) * (0.7 + 0.3 * smooth(ratioCoherence, 0.35, 0.65))

  // degeneracy tics: too much sliver area (RENDERED aspect, so non-square cells are judged honestly),
  // or too many near-invisible cells.
  const sliverArea = mods.reduce((s, m) => {
    const k = (m.w / m.h) * aspect
    return s + (Math.max(k, 1 / k) > 4 ? m.w * m.h : 0)
  }, 0)
  const sliverTic = sliverArea > 0.15 ? 0.82 : sliverArea > 0.05 ? 0.93 : 1
  const tinyFrac = areas.filter((a) => a < 0.004).length / n
  const tinyTic = tinyFrac > 0.2 ? 0.85 : 1

  const total = weighted * coherenceGate * sliverTic * tinyTic

  return { total, aspectQuality, alignment, ratioCoherence, whitespaceRhythm, hierarchy, balance, complexityMatch, interest }
}
