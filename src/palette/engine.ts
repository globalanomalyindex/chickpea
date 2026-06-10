/**
 * Palette engine — turns (seed, count) into a finished, always-usable, always-beautiful palette.
 *
 * There are no recipes and no loaded palettes. A palette is searched for: the SELECTOR samples a
 * population of procedural genomes (generator.ts), scores each (score.ts), keeps the best, then
 * hill-climbs the champion (mutate → regenerate → keep if better) for a few steps. Only the champion
 * is emitted, so the output always clears the quality bar — and the search is what makes each
 * generation feel iteratively considered rather than random.
 *
 * The HARMONIZER then enforces the last invariants on the winner: a usable lightness spread, no
 * perceptual duplicates, hero-first order. Finally it converts to sRGB via hue-preserving gamut
 * mapping. Pure and deterministic for (seed, count).
 */

import { mulberry32, type Rng } from '../grid/prng'
import { gamutMapToRgb, deltaE, maxChroma, type Oklch } from './oklch'
import { rgbToHex, rgbToHsl } from './hsl'
import type { PaletteColor } from './generate'
import { sampleGenome, mutateGenome, genomeToPalette, type Genome } from './generator'
import { scorePalette } from './score'

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const wrapHue = (h: number): number => ((h % 360) + 360) % 360

const MIN_LIGHTNESS_SPREAD = 0.28 // gentle floor — high enough for usable contrast, low enough that
// a deliberate high-key (pastel) or low-key (moody) palette isn't stretched back into a full ladder
const DEDUPE_DELTA = 0.08 // perceptual distinctness floor — audit found 0.072 let near-twins read samey
const POPULATION = 30 // candidate genomes sampled per generation
const ELITES = 3 // distinct champions that each get their own hill-climb (separate basins)
const CLIMB_STEPS = 12 // hill-climb refinements per elite

// ---- selector ----

/** Search a population of genomes, then hill-climb the top ELITES independently and keep the global
 * winner. Climbing several basins instead of one means a near-miss second genre (say, a ramp that
 * sampled slightly rough) can refine into the champion instead of losing to the safest first draw —
 * better palettes AND better variety across seeds.
 *
 * Every candidate is HARMONIZED before scoring, so selection judges exactly the palette that will
 * ship. Scoring the raw expansion and harmonizing afterwards let the spread-stretch move a winner
 * across a scoring boundary post-selection (measured: a champion that re-scored at 0.18). */
function selectBest(rng: Rng, count: number): Oklch[] {
  interface Cand {
    g: Genome
    pal: Oklch[]
    s: number
  }
  const pop: Cand[] = []
  for (let i = 0; i < POPULATION; i++) {
    const g = sampleGenome(rng)
    const pal = harmonize(genomeToPalette(g, count, rng))
    pop.push({ g, pal, s: scorePalette(pal).total })
  }
  pop.sort((a, b) => b.s - a.s)
  // genre-aware elites: the top two by score, plus the best KEYED candidate (all-dark moody or
  // all-light pastel) when one exists. Winner-take-all was discarding ~90% of sampled moody
  // genomes — the wide-ladder template out-muscled them before refinement could help. Reserving
  // a basin keeps the rare genres alive without lowering the quality bar: the key still has to
  // out-score everyone AFTER its climb to win.
  const isKeyed = (c: Cand): boolean => {
    let lo = 1
    let hi = 0
    for (const col of c.pal) {
      lo = Math.min(lo, col.L)
      hi = Math.max(hi, col.L)
    }
    return hi < 0.52 || lo > 0.52
  }
  // a quiet field carrying one or two saturated figures — the other rare region winner-take-all
  // starves before refinement (same coverage logic as the keys; nothing about it is a style)
  const isQuietField = (c: Cand): boolean => {
    const quiet = c.pal.filter((col) => col.C <= 0.055).length
    const figures = c.pal.filter((col) => col.C >= 0.1).length
    return quiet >= c.pal.length - 2 && figures >= 1 && figures <= 2
  }
  const elites: Cand[] = pop.slice(0, 2)
  const rare = pop.find((c) => isKeyed(c) || isQuietField(c))
  if (rare && !elites.includes(rare)) elites.push(rare)
  else if (pop[2]) elites.push(pop[2])

  let best = pop[0]
  for (let e = 0; e < Math.min(ELITES, elites.length); e++) {
    let cur = elites[e]
    // amplitude decays for fine-tuning; keep any improvement
    for (let i = 0; i < CLIMB_STEPS; i++) {
      const amt = lerp(0.9, 0.3, i / Math.max(1, CLIMB_STEPS - 1))
      const g = mutateGenome(cur.g, rng, amt)
      const pal = harmonize(genomeToPalette(g, count, rng))
      const s = scorePalette(pal).total
      if (s > cur.s) cur = { g, pal, s }
    }
    if (cur.s > best.s) best = cur
  }
  return best.pal
}

// ---- harmonizer ----

/** The full finishing pass: usable lightness spread, no perceptual duplicates, hero first.
 * Applied to every CANDIDATE before scoring (score what ships), not to the winner after. */
function harmonize(cs: Oklch[]): Oklch[] {
  return orderHeroFirst(dedupe(enforceSpread(cs)))
}

/** Guarantee the lightness range spans at least MIN_LIGHTNESS_SPREAD by stretching L around the
 * midpoint (perceptually even in OKLCH), so a composition always has a light, a dark, and a usable
 * background. The selector already favors good contrast; this is the safety net. */
function enforceSpread(cs: Oklch[]): Oklch[] {
  if (cs.length < 2) return cs
  const Ls = cs.map((c) => c.L)
  const lo = Math.min(...Ls)
  const hi = Math.max(...Ls)
  const spread = hi - lo
  if (spread >= MIN_LIGHTNESS_SPREAD) return cs
  const mid = (lo + hi) / 2
  let tlo = mid - MIN_LIGHTNESS_SPREAD / 2
  let thi = mid + MIN_LIGHTNESS_SPREAD / 2
  if (tlo < 0.08) {
    thi += 0.08 - tlo
    tlo = 0.08
  }
  if (thi > 0.96) {
    tlo -= thi - 0.96
    thi = 0.96
  }
  return cs.map((c, i) => {
    const L =
      spread < 1e-4
        ? lerp(tlo, thi, cs.length === 1 ? 0.5 : i / (cs.length - 1))
        : tlo + (c.L - lo) * ((thi - tlo) / spread)
    return { ...c, L: clamp01(L) }
  })
}

/** Nudge apart colors that are perceptually identical (small ΔE) until each clears EVERY other.
 * Only hue/chroma move; lightness is left alone so the enforced spread survives. Candidate nudges
 * go BOTH ways and the gentlest one that clears wins — the old fix always swung +26° toward one
 * side, which could kink a careful scheme; this one preserves it. */
function dedupe(cs: Oklch[]): Oklch[] {
  const out = cs.map((c) => ({ ...c }))
  const minTo = (c: Oklch, skip: number): number => {
    let m = Infinity
    for (let j = 0; j < out.length; j++) if (j !== skip) m = Math.min(m, deltaE(c, out[j]))
    return m
  }
  for (let i = 0; i < out.length; i++) {
    let guard = 0
    while (guard++ < 12 && minTo(out[i], i) < DEDUPE_DELTA) {
      const c = out[i]
      const opts: Oklch[] = [
        { L: c.L, C: c.C, H: wrapHue(c.H + 14) },
        { L: c.L, C: c.C, H: wrapHue(c.H - 14) },
        { L: c.L, C: Math.min(0.26, c.C + 0.025), H: wrapHue(c.H + 10) },
        { L: c.L, C: Math.max(0.02, c.C - 0.025), H: wrapHue(c.H - 10) },
        { L: c.L, C: Math.min(0.26, c.C + 0.02), H: wrapHue(c.H + 26) },
        { L: c.L, C: Math.min(0.26, c.C + 0.02), H: wrapHue(c.H - 26) },
      ]
      const clearing = opts.filter((o) => minTo(o, i) >= DEDUPE_DELTA)
      if (clearing.length > 0) {
        let bi = 0
        for (let k = 1; k < clearing.length; k++) if (deltaE(clearing[k], c) < deltaE(clearing[bi], c)) bi = k
        out[i] = clearing[bi]
        break
      }
      // nothing clears in one move: take the most progress and loop
      let bi = 0
      for (let k = 1; k < opts.length; k++) if (minTo(opts[k], i) > minTo(opts[bi], i)) bi = k
      out[i] = opts[bi]
    }
  }
  return out
}

/** "Hero-ness": saturated AND well-lit. Saturation is judged RELATIVE to the color's own gamut
 * headroom with a real-chroma ramp — absolute chroma made 86% of heroes magenta/purple (the
 * deepest sRGB region) and locked gold, vermilion and cyan out of the lead (audit census). */
function heroScore(c: Oklch): number {
  const midL = 1 - Math.abs(c.L - 0.6) / 0.6
  const head = maxChroma(c.L, c.H)
  const rel = head > 0.02 ? Math.min(1, c.C / head) : 0
  const real = clamp01((c.C - 0.05) / 0.06) // C 0.05→0.11 ramps in; faint tints can't lead
  return rel * real * (0.35 + 0.65 * clamp01(midL))
}

/** Hero color first (the dominant module's fill); the rest by descending chroma. */
function orderHeroFirst(cs: Oklch[]): Oklch[] {
  if (cs.length < 2) return cs
  let hi = 0
  for (let i = 1; i < cs.length; i++) if (heroScore(cs[i]) > heroScore(cs[hi])) hi = i
  const hero = cs[hi]
  const rest = cs.filter((_, i) => i !== hi).sort((a, b) => b.C - a.C)
  return [hero, ...rest]
}

// ---- public API ----

/** The full harmonized OKLCH palette for (seed, count) — pure and deterministic. */
export function generatePaletteOklch(seed: number, count: number): Oklch[] {
  const n = Math.max(1, Math.round(count))
  const rng: Rng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  // candidates are harmonized before scoring inside the selector — the champion ships as judged
  return selectBest(rng, n)
}

/** Map a harmonized OKLCH palette to the studio's `PaletteColor[]` (sRGB hex + truthful HSL readout). */
export function paletteFromOklch(colors: Oklch[]): PaletteColor[] {
  return colors.map((c, i) => {
    const rgb = gamutMapToRgb(c)
    const [h, s, l] = rgbToHsl(rgb)
    return { hex: rgbToHex(rgb), rgb, h, s, l, weight: colors.length - i }
  })
}

/** Public entry: a finished sRGB palette of `count` colors, selected for quality. */
export function generatePaletteColors(seed: number, count: number): PaletteColor[] {
  return paletteFromOklch(generatePaletteOklch(seed, count))
}
