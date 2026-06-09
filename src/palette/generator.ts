/**
 * The data-free procedural palette sampler. No loaded palettes, no named genres — a palette is one
 * point in a continuous parameter space (a "genome"), and every recognizable genre EMERGES from
 * where in that space a seed lands:
 *
 *   - hue:   a von Mises mixture. #modes (1..4) + concentration κ continuously spans mono → analogous
 *            → complementary → triad/tetrad → chaos. Even-spaced modes feel like classic schemes;
 *            clustered modes give asymmetric harmonies with no name.
 *   - light: a contrast band [lo,hi] (width = contrast) shaped by a skew/bimodal warp — even ladder
 *            (graphic), pushed-light (pastel/high-key), pushed-dark (neon/moody), split (duotone).
 *   - chroma:requested as a FRACTION of each color's in-gamut headroom (so intent ≈ render), with a
 *            neutral-bias that suppresses chroma on non-accent colors → the "neutrals + pops" genre,
 *            and a chroma-vs-lightness coupling that can peak at mid-L like natural pigments.
 *
 * `sampleGenome` draws the character; `genomeToPalette` expands it to `count` OKLCH colors. The
 * scorer + selector (engine.ts) then search many genomes and emit only a high-quality champion.
 */

import { type Rng } from '../grid/prng'
import { maxChroma, type Oklch } from './oklch'
import { vonMises, warpedLadder, clamp, lerp, wrap360, hueGap } from './sampling'

/** Requested chroma is held to this fraction of the in-gamut headroom, so accents sit just inside
 * the gamut boundary and gamut mapping at emit time is a near-no-op (intent ≈ render). */
const HEAD_FRAC = 0.92

export interface Genome {
  modeCenters: number[] // absolute hue centers (degrees) of the von Mises mixture
  kappa: number // hue concentration (high = tight/mono, low = spread)
  lLo: number // lightness band floor
  lHi: number // lightness band ceiling
  lSkew: number // lightness distribution skew (− dark-key, 0 even, + light-key)
  bimodal: boolean // split lightness toward the band ends (duotone/high-contrast)
  chromaFrac: number // base colorfulness as a fraction of gamut headroom
  chromaJitter: number // per-color chroma variation
  neutralBias: number // 0 = uniform chroma; >0 suppresses non-accent chroma (neutrals + pops)
  accentCount: number // colors promoted to full chroma
  couple: number // 0..1 strength of chroma peaking at mid lightness
}

const pickWeighted = (rng: Rng, weights: number[]): number => {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}

/** The von Mises mixture's mode centers around `base`: 1..4 modes (biased toward more hues), placed
 * either evenly (triad/tetrad feel) or clustered. Clustered centers reject within 22° of an existing
 * one (≤8 fixed redraws) so a 2-mode palette never silently collapses into a 1-mode one. */
function sampleModeCenters(rng: Rng, base: number): number[] {
  const modes = pickWeighted(rng, [0.2, 0.28, 0.3, 0.22]) + 1 // biased toward triad/tetrad multi-hue
  const evenSpaced = rng() < 0.62
  const centers: number[] = []
  for (let i = 0; i < modes; i++) {
    if (evenSpaced) {
      centers.push(wrap360(base + (360 / modes) * i + (rng() * 2 - 1) * 10))
    } else {
      let h = wrap360(base + rng() * 360)
      for (let t = 0; t < 8 && centers.some((c) => hueGap(c, h) < 22); t++) h = wrap360(base + rng() * 360)
      centers.push(h)
    }
  }
  return centers
}

/** Draw one palette's character. Every axis is continuous/wide so the space spans every genre. */
export function sampleGenome(rng: Rng): Genome {
  const base = rng() * 360
  const centers = sampleModeCenters(rng, base)
  // κ on a log scale: ~0.5 (loose/spread) → ~16 typical, occasionally ~60 (tight mono). Lower than
  // before so multi-hue/spread palettes are common, not just analogous clusters.
  const kappa = Math.exp(lerp(Math.log(0.5), Math.log(rng() < 0.22 ? 60 : 16), rng()))

  // lightness band: a center + a contrast span, clamped with a guaranteed width. Floor at 0.1 so the
  // darkest color is a rich dark, not pure black (paired with the chroma floor in genomeToPalette).
  // lightness band: a center + span. ~28% of palettes get a NARROW band placed high or low (a
  // deliberate KEY — high-key pastel, low-key moody/neon-void) so those genres are actually
  // reachable; the rest span wider. No forced-wide floor here (it would erase the narrow keys); the
  // harmonizer's gentle min-spread is the only safety net. Ceiling 0.92 keeps the lightest a cream.
  const lMid = lerp(0.3, 0.74, rng())
  const narrow = rng() < 0.28
  const span = narrow ? lerp(0.22, 0.4, rng()) : lerp(0.42, 0.82, rng())
  const lLo = clamp(lMid - span / 2, 0.12, 0.86)
  const lHi = clamp(lMid + span / 2, 0.24, 0.92)

  // neutral-bias (suppress non-accent chroma → "neutrals + pops") is one genre among many, not the
  // default — less frequent and less extreme so palettes don't skew desaturated.
  const neutralBias = rng() < 0.3 ? lerp(0.3, 0.7, rng()) : 0
  return {
    modeCenters: centers,
    kappa,
    lLo,
    lHi,
    lSkew: (rng() * 2 - 1) * 1.7,
    bimodal: rng() < 0.18,
    chromaFrac: lerp(0.2, 0.98, Math.pow(rng(), 0.82)), // skewed toward vivid, with a floor
    chromaJitter: lerp(0.05, 0.3, rng()),
    neutralBias,
    accentCount: neutralBias > 0 ? (rng() < 0.5 ? 1 : 2) : rng() < 0.3 ? 1 : 0,
    couple: rng() * 0.8,
  }
}

/** Mutate a genome for the selector's hill-climb. Mostly small Gaussian nudges, but 25% of the time
 * ONE structural jump (resample the hue mixture, flip bimodal, or re-roll the skew) that the
 * continuous perturbations can't reach — the discrete moves that stop nearby seeds looking samey.
 * Pure given the rng. */
export function mutateGenome(g: Genome, rng: Rng, amt = 1): Genome {
  const j = (a: number) => (rng() * 2 - 1) * a * amt
  const next: Genome = {
    ...g,
    modeCenters: g.modeCenters.map((c) => wrap360(c + j(12))),
    kappa: clamp(g.kappa * Math.exp(j(0.4)), 0.5, 90),
    lLo: clamp(g.lLo + j(0.05), 0.12, 0.86),
    lHi: clamp(Math.max(g.lLo + 0.12, g.lHi + j(0.05)), 0.24, 0.92),
    lSkew: clamp(g.lSkew + j(0.4), -2, 2),
    chromaFrac: clamp(g.chromaFrac + j(0.12), 0.12, 1),
    chromaJitter: clamp(g.chromaJitter + j(0.06), 0.02, 0.35),
    neutralBias: clamp(g.neutralBias + (g.neutralBias > 0 ? j(0.12) : 0), 0, 0.9),
    couple: clamp(g.couple + j(0.2), 0, 0.8),
  }
  if (rng() < 0.25) {
    const k = Math.floor(rng() * 3)
    if (k === 0) next.modeCenters = sampleModeCenters(rng, g.modeCenters[0] ?? rng() * 360)
    else if (k === 1) next.bimodal = !g.bimodal
    else next.lSkew = (rng() * 2 - 1) * 1.7
  }
  return next
}

/** A gentle bump that peaks at t≈0.55 (used for chroma-vs-lightness coupling). Floored at 0.5 so
 * even fully-coupled dark/light ends keep real chroma — deep jewel darks and tints, not gray/black. */
const couplingCurve = (L: number): number => 0.5 + 0.5 * (1 - Math.abs(L - 0.55) / 0.55)

/** Expand a genome into `count` OKLCH colors. Deterministic given the rng. */
export function genomeToPalette(g: Genome, count: number, rng: Rng): Oklch[] {
  const n = Math.max(1, count)

  // hues: round-robin across modes, each sampled from its von Mises lobe
  const hues: number[] = []
  for (let i = 0; i < n; i++) {
    const center = g.modeCenters[i % g.modeCenters.length]
    hues.push(vonMises(rng, center, g.kappa))
  }

  // lightness: a warped ladder mapped into the band; bimodal splits values toward the ends
  let ts = warpedLadder(n, g.lSkew)
  if (g.bimodal) ts = ts.map((t) => (t < 0.5 ? t * t * 2 : 1 - (1 - t) * (1 - t) * 2))
  const Ls = ts.map((t) => lerp(g.lLo, g.lHi, t))
  // rich-dark fix: if the darkest slot's hue can't carry chroma at its lightness (low-headroom hues
  // like cyan/blue bottom out near-black), lift its L until some chroma fits — a deep color, not black.
  let dk = 0
  for (let i = 1; i < n; i++) if (Ls[i] < Ls[dk]) dk = i
  while (Ls[dk] < 0.32 && maxChroma(Ls[dk], hues[dk]) < 0.05) Ls[dk] += 0.02

  // accents: the `accentCount` most chroma-capable slots get full chroma; the rest may be suppressed
  const capacity = Ls.map((L, i) => maxChroma(L, hues[i]))
  const accentIdx = new Set(
    capacity
      .map((c, i) => ({ c, i }))
      .sort((a, b) => b.c - a.c)
      .slice(0, g.accentCount)
      .map((o) => o.i),
  )

  const out: Oklch[] = []
  for (let i = 0; i < n; i++) {
    const L = Ls[i]
    const H = hues[i]
    const headroom = capacity[i]
    const couplingFactor = lerp(1, couplingCurve(L), g.couple)
    const suppression = accentIdx.has(i) ? 1 : 1 - g.neutralBias
    const jitter = 1 + (rng() * 2 - 1) * g.chromaJitter
    // deep slots reach further toward their (small) gamut headroom so darks read rich, not grayed.
    const darkBoost = lerp(1, 1.6, (0.3 - L < 0 ? 0 : 0.3 - L > 0.15 ? 1 : (0.3 - L) / 0.15))
    const frac = clamp(g.chromaFrac * couplingFactor * suppression * jitter * darkBoost, 0, 1)
    out.push({ L, C: headroom * frac * HEAD_FRAC, H })
  }

  // one deliberate off-cluster accent: nudge the most chromatic color a few degrees off its mode for
  // focal tension (feeds the scorer's interest term), re-clamped so it stays in gamut.
  if (rng() < 0.55 && out.length >= 2) {
    let hi = 0
    for (let i = 1; i < out.length; i++) if (out[i].C > out[hi].C) hi = i
    const dir = rng() < 0.5 ? -1 : 1
    const H2 = wrap360(out[hi].H + dir * (8 + rng() * 10))
    out[hi] = { L: out[hi].L, C: Math.min(out[hi].C, maxChroma(out[hi].L, H2)), H: H2 }
  }
  return out
}
