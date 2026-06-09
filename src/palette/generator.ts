/**
 * The data-free procedural palette sampler. No loaded palettes, no named genres — a palette is one
 * point in a continuous parameter space (a "genome"), and every recognizable genre EMERGES from
 * where in that space a seed lands:
 *
 *   - hue:   a WEIGHTED von Mises mixture. #modes (1..4) + concentration κ continuously spans mono →
 *            analogous → complementary → triad/tetrad → chaos. Dirichlet-style mode weights give a
 *            palette 60-30-10 structure (a dominant family + counterpoints) instead of equal slices,
 *            and each mode carries its own concentration (a tight dominant family, a looser accent).
 *   - ramp:  a hue-lightness DRIFT can couple the two axes — hue travels systematically as lightness
 *            climbs, the way nature's gradients work (sunset: deep violet → orange → pale gold;
 *            ocean depth; foliage). Sign-biased toward the painters' warm-light/cool-dark convention.
 *   - light: a contrast band [lo,hi] (width = contrast) shaped by a skew/bimodal warp — even ladder
 *            (graphic), pushed-light (pastel/high-key), pushed-dark (neon/moody), split (duotone).
 *   - chroma:requested as a FRACTION of each color's in-gamut headroom (so intent ≈ render), with a
 *            neutral-bias that suppresses chroma on non-accent colors → the "neutrals + pops" genre,
 *            and a chroma-vs-lightness coupling that can peak at mid-L like natural pigments.
 *   - cast:  an optional shared OKLab (a,b) offset — the same touch of one pigment mixed into every
 *            color, painters' "everything under the same light" — for atmospheric unity.
 *
 * `sampleGenome` draws the character; `genomeToPalette` expands it to `count` OKLCH colors. The
 * scorer + selector (engine.ts) then search many genomes and emit only a high-quality champion.
 */

import { type Rng } from '../grid/prng'
import { maxChroma, oklchToOklab, type Oklch } from './oklch'
import { vonMises, warpedLadder, sampleWeights, clamp, lerp, wrap360, hueGap } from './sampling'

/** Requested chroma is held to this fraction of the in-gamut headroom, so accents sit just inside
 * the gamut boundary and gamut mapping at emit time is a near-no-op (intent ≈ render). */
const HEAD_FRAC = 0.92

/** The warm anchor (gold, ≈75°) the ramp's sign bias points the LIGHT end toward — the
 * warm-light/cool-dark convention that makes natural gradients read as lit rather than inverted. */
const WARM_ANCHOR = 75

export interface Genome {
  modeCenters: number[] // absolute hue centers (degrees) of the von Mises mixture
  modeWeights: number[] // hue share per mode (sums to 1) — 60-30-10 dominance structure
  modeKappaMul: number[] // per-mode concentration multiplier (tight dominant, loose accent, …)
  kappa: number // base hue concentration (high = tight/mono, low = spread)
  hueDrift: number // signed degrees of hue travel across the lightness ladder (0 = off; ramp genre)
  lLo: number // lightness band floor
  lHi: number // lightness band ceiling
  lSkew: number // lightness distribution skew (− dark-key, 0 even, + light-key)
  bimodal: boolean // split lightness toward the band ends (duotone/high-contrast)
  chromaFrac: number // base colorfulness as a fraction of gamut headroom
  chromaJitter: number // per-color chroma variation
  neutralBias: number // 0 = uniform chroma; >0 suppresses non-accent chroma (neutrals + pops)
  accentCount: number // colors promoted to full chroma
  couple: number // 0..1 strength of chroma peaking at mid lightness
  castA: number // shared OKLab a-offset — atmospheric unity (0 = off)
  castB: number // shared OKLab b-offset
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
  // near-even mode prior, tilted slightly toward 1-2 families: apportionment now guarantees every
  // sampled family a slot, so multi-mode genomes read busier than they used to — without the tilt,
  // mono/analogous palettes fell to ~5% of winners (measured)
  const modes = pickWeighted(rng, [0.27, 0.3, 0.25, 0.18]) + 1
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

/** Per-mode concentration multipliers: each family can be tighter or looser than the base κ.
 * A tight dominant family + a loose accent is what gives mixtures painterly asymmetry. */
function sampleKappaMuls(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => Math.exp((rng() * 2 - 1) * 0.7)) // ~[0.5, 2]
}

/** A signed ramp drift whose LIGHT end leans warm (gold), the way sunlight grades: a wrong-way
 * (cool-light) draw is corrected with p=0.7, so ~15% of ramps stay inverted as a deliberate move. */
function sampleDrift(rng: Rng, center: number): number {
  const mag = lerp(35, 150, rng())
  let drift = rng() < 0.5 ? mag : -mag
  const lightEnd = wrap360(center + drift / 2)
  const darkEnd = wrap360(center - drift / 2)
  if (hueGap(lightEnd, WARM_ANCHOR) > hueGap(darkEnd, WARM_ANCHOR) && rng() < 0.7) drift = -drift
  return drift
}

/** Draw one palette's character. Every axis is continuous/wide so the space spans every genre. */
export function sampleGenome(rng: Rng): Genome {
  const base = rng() * 360
  const centers = sampleModeCenters(rng, base)
  const weights = sampleWeights(rng, centers.length, lerp(1, 2.2, rng()))
  const kappaMuls = sampleKappaMuls(rng, centers.length)
  // κ on a log scale: ~0.5 (loose/spread) → ~16 typical, occasionally ~60 (tight mono). Lower than
  // before so multi-hue/spread palettes are common, not just analogous clusters.
  const kappa = Math.exp(lerp(Math.log(0.5), Math.log(rng() < 0.22 ? 60 : 16), rng()))

  // ramp genre: ~12% of genomes couple hue to the lightness ladder. The drift REPLACES the mixture
  // (a ramp is one continuously-traveling family); selection decides whether it wins the seed —
  // measured, true gradual ramps land in roughly that share of winners.
  const hueDrift = rng() < 0.12 ? sampleDrift(rng, centers[0]) : 0

  // lightness band: a center + span. ~28% of palettes get a NARROW band — a deliberate KEY — and a
  // key PICKS A SIDE (high-key pastel or low-key moody/neon-void): a narrow band centered mid-range
  // is the muddy middle, not a genre, and sampling lMid uniformly made true keys nearly unreachable
  // (measured 0.8% of winners). The rest span wider. No forced-wide floor here (it would erase the
  // narrow keys); the harmonizer's gentle min-spread is the only safety net. Ceiling 0.92 keeps the
  // lightest a cream.
  const narrow = rng() < 0.28
  const lMid = narrow ? (rng() < 0.55 ? lerp(0.62, 0.78, rng()) : lerp(0.26, 0.4, rng())) : lerp(0.3, 0.74, rng())
  const span = narrow ? lerp(0.22, 0.4, rng()) : lerp(0.42, 0.82, rng())
  const lLo = clamp(lMid - span / 2, 0.12, 0.86)
  const lHi = clamp(lMid + span / 2, 0.24, 0.92)

  // neutral-bias (suppress non-accent chroma → "neutrals + pops") is one genre among many, not the
  // default — less frequent and less extreme so palettes don't skew desaturated.
  const neutralBias = rng() < 0.3 ? lerp(0.3, 0.7, rng()) : 0

  // atmospheric cast: ~35% of genomes mix a shared OKLab offset into every color — one light source.
  const castOn = rng() < 0.35
  const castMag = castOn ? lerp(0.004, 0.016, rng()) : 0
  const castAng = rng() * Math.PI * 2
  return {
    modeCenters: centers,
    modeWeights: weights,
    modeKappaMul: kappaMuls,
    kappa,
    hueDrift,
    lLo,
    lHi,
    lSkew: (rng() * 2 - 1) * 1.7,
    bimodal: rng() < 0.18,
    chromaFrac: lerp(0.2, 0.98, Math.pow(rng(), 0.82)), // skewed toward vivid, with a floor
    chromaJitter: lerp(0.05, 0.3, rng()),
    neutralBias,
    accentCount: neutralBias > 0 ? (rng() < 0.5 ? 1 : 2) : rng() < 0.3 ? 1 : 0,
    couple: rng() * 0.8,
    castA: castMag * Math.cos(castAng),
    castB: castMag * Math.sin(castAng),
  }
}

/** Mutate a genome for the selector's hill-climb. Mostly small Gaussian nudges, but 25% of the time
 * ONE structural jump (resample the hue mixture, flip bimodal, re-roll the skew, or toggle the ramp)
 * that the continuous perturbations can't reach — the discrete moves that stop nearby seeds looking
 * samey. Pure given the rng. */
export function mutateGenome(g: Genome, rng: Rng, amt = 1): Genome {
  const j = (a: number) => (rng() * 2 - 1) * a * amt
  const wRaw = g.modeWeights.map((w) => Math.max(0.02, w + j(0.08)))
  const wSum = wRaw.reduce((a, b) => a + b, 0)
  const next: Genome = {
    ...g,
    modeCenters: g.modeCenters.map((c) => wrap360(c + j(12))),
    modeWeights: wRaw.map((w) => w / wSum),
    modeKappaMul: g.modeKappaMul.map((m) => clamp(m * Math.exp(j(0.2)), 0.4, 2.4)),
    kappa: clamp(g.kappa * Math.exp(j(0.4)), 0.5, 90),
    hueDrift: g.hueDrift === 0 ? 0 : clamp(g.hueDrift + j(14), -170, 170),
    lLo: clamp(g.lLo + j(0.05), 0.12, 0.86),
    lHi: clamp(Math.max(g.lLo + 0.12, g.lHi + j(0.05)), 0.24, 0.92),
    lSkew: clamp(g.lSkew + j(0.4), -2, 2),
    chromaFrac: clamp(g.chromaFrac + j(0.12), 0.12, 1),
    chromaJitter: clamp(g.chromaJitter + j(0.06), 0.02, 0.35),
    neutralBias: clamp(g.neutralBias + (g.neutralBias > 0 ? j(0.12) : 0), 0, 0.9),
    couple: clamp(g.couple + j(0.2), 0, 0.8),
    castA: clamp(g.castA + j(0.003), -0.02, 0.02),
    castB: clamp(g.castB + j(0.003), -0.02, 0.02),
  }
  if (rng() < 0.25) {
    const k = Math.floor(rng() * 4)
    if (k === 0) {
      next.modeCenters = sampleModeCenters(rng, g.modeCenters[0] ?? rng() * 360)
      next.modeWeights = sampleWeights(rng, next.modeCenters.length, lerp(1, 2.2, rng()))
      next.modeKappaMul = sampleKappaMuls(rng, next.modeCenters.length)
    } else if (k === 1) next.bimodal = !g.bimodal
    else if (k === 2) next.lSkew = (rng() * 2 - 1) * 1.7
    else if (g.hueDrift !== 0) next.hueDrift = 0
    // never toggles a ramp ON mid-climb: with the ramp road scoring well, that one-way door was
    // converting other genres into ramps during refinement (measured: ramps won 42% of seeds).
  }
  return next
}

/** A gentle bump that peaks at t≈0.55 (used for chroma-vs-lightness coupling). Floored at 0.5 so
 * even fully-coupled dark/light ends keep real chroma — deep jewel darks and tints, not gray/black. */
const couplingCurve = (L: number): number => 0.5 + 0.5 * (1 - Math.abs(L - 0.55) / 0.55)

/**
 * Apportion `n` palette slots across the mixture's modes by weight, then INTERLEAVE them — always
 * emit the mode with the most slots still owed — so the dominant family spreads across the whole
 * lightness ladder with counterpoints interspersed, instead of pooling at one end.
 *
 * Every sampled mode is seeded with ONE slot first (when there's room), and only the remainder
 * follows the weights by greatest deficit. Plain largest-remainder rounding silently dropped any
 * family under ~1/(2n) — an audit measured 63% of multi-mode genomes losing a family and 20%
 * collapsing to one — which broke the genome's documented "no mode silently vanishes" contract.
 * Returns the mode index for each slot, in ladder order.
 */
export function apportionModes(weights: number[], n: number): number[] {
  const k = weights.length
  const counts = new Array<number>(k).fill(0)
  if (n >= k) {
    counts.fill(1)
  } else {
    // not enough slots for everyone: the heaviest families win
    weights
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w - a.w)
      .slice(0, n)
      .forEach(({ i }) => (counts[i] = 1))
  }
  let left = n - counts.reduce((a, b) => a + b, 0)
  while (left > 0) {
    let m = 0
    for (let i = 1; i < k; i++) if (weights[i] * n - counts[i] > weights[m] * n - counts[m]) m = i
    counts[m]++
    left--
  }
  const remaining = [...counts]
  const order: number[] = []
  for (let s = 0; s < n; s++) {
    let m = 0
    for (let i = 1; i < remaining.length; i++) if (remaining[i] > remaining[m]) m = i
    order.push(m)
    remaining[m]--
  }
  return order
}

/** Mix the genome's shared cast into one color in OKLab space (same offset for every color — one
 * light source), then re-express as OKLCH with chroma re-clamped to the new hue's headroom. */
function applyCast(c: Oklch, castA: number, castB: number): Oklch {
  if (castA === 0 && castB === 0) return c
  const [L, a, b] = oklchToOklab(c)
  const a2 = a + castA
  const b2 = b + castB
  let H = (Math.atan2(b2, a2) * 180) / Math.PI
  if (H < 0) H += 360
  const C = Math.min(Math.hypot(a2, b2), maxChroma(L, H) * 0.98)
  return { L, C, H }
}

/** Expand a genome into `count` OKLCH colors. Deterministic given the rng. */
export function genomeToPalette(g: Genome, count: number, rng: Rng): Oklch[] {
  const n = Math.max(1, count)

  // lightness first (the ladder is the palette's spine; ramp hues travel along it)
  let ts = warpedLadder(n, g.lSkew)
  if (g.bimodal) ts = ts.map((t) => (t < 0.5 ? t * t * 2 : 1 - (1 - t) * (1 - t) * 2))
  const Ls = ts.map((t) => lerp(g.lLo, g.lHi, t))

  // hues: a ramp travels with the ladder (nature's gradients); otherwise a weighted mixture, each
  // slot drawn from its apportioned mode's von Mises lobe at that mode's own concentration.
  const hues: number[] = []
  if (g.hueDrift !== 0) {
    const center = g.modeCenters[0]
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1)
      hues.push(wrap360(center + g.hueDrift * (t - 0.5) + (rng() * 2 - 1) * 7))
    }
  } else {
    const slotMode = apportionModes(g.modeWeights, n)
    for (let i = 0; i < n; i++) {
      const m = slotMode[i]
      hues.push(vonMises(rng, g.modeCenters[m], g.kappa * g.modeKappaMul[m]))
    }
  }

  // rich-dark fix: if the darkest slot's hue can't carry chroma at its lightness (low-headroom hues
  // like cyan/blue bottom out near-black), lift its L until some chroma fits — a deep color, not black.
  let dk = 0
  for (let i = 1; i < n; i++) if (Ls[i] < Ls[dk]) dk = i
  while (Ls[dk] < 0.32 && maxChroma(Ls[dk], hues[dk]) < 0.05) Ls[dk] += 0.02

  // accents: the best-LIT slots (nearest mid lightness) get full chroma; the rest may be
  // suppressed. Picking by gamut capacity instead funneled accents toward the deepest-gamut hue
  // region (magenta/violet) — one of three compounding biases an audit traced behind 86% of hero
  // colors landing purple. Mid-L proximity is hue-fair.
  const capacity = Ls.map((L, i) => maxChroma(L, hues[i]))
  const accentIdx = new Set(
    Ls.map((L, i) => ({ d: Math.abs(L - 0.58), i }))
      .sort((a, b) => a.d - b.d)
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
  // focal tension (feeds the scorer's interest term), re-clamped so it stays in gamut. Skipped for
  // ramps — their tension IS the drift; a kink would break the gradient's line.
  if (g.hueDrift === 0 && rng() < 0.55 && out.length >= 2) {
    let hi = 0
    for (let i = 1; i < out.length; i++) if (out[i].C > out[hi].C) hi = i
    const dir = rng() < 0.5 ? -1 : 1
    const H2 = wrap360(out[hi].H + dir * (8 + rng() * 10))
    out[hi] = { L: out[hi].L, C: Math.min(out[hi].C, maxChroma(out[hi].L, H2)), H: H2 }
  }

  // atmospheric unity last: the same cast mixed into every finished color, like shared light.
  return out.map((c) => applyCast(c, g.castA, g.castB))
}
