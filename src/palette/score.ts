/**
 * Perceptual quality score for a candidate palette — the judge that makes "always beautiful" real.
 * The selector samples many genomes and emits only a high-scoring one, so quality is a property of
 * the OUTPUT, not a hope about the average draw. Every term returns 0..1 (1 = best); the total is
 * their weighted sum, times a coherence gate and a near-black tic penalty.
 *
 * Hardened against an adversarial audit that found three terms could be fooled by the SAME feature
 * (a lone vivid chip among grays scored ~0.89 because vibrancy, focal AND harmony each rewarded it).
 * The cross-checks below — a chromatic-mass term, a second-chroma gate on focal, a concentration
 * damp on harmony, and a coherence gate on the total — make the terms disagree on a dud instead of
 * colluding. Terms:
 *   contrast      — a usable lightness range (soft bonus for a dark+light pair; high-key still ok)
 *   separation    — every pair perceptually distinct
 *   harmony       — chroma-weighted hue structure (tight OR evenly spaced), damped when one color
 *                   hogs the chroma mass or when hues scatter past a triad
 *   focal         — one chromatic lead WITH a real second color (60-30-10), not a lone chip
 *   antiMud       — don't crowd the brown/olive mud zone (earthy palettes discounted)
 *   vibrancy      — real color, rewarded up to jewel intensity; all-gray loses
 *   chromaticMass — several genuinely-colored slots, not one pop padded with grays
 *   interest      — striking variety, gated by harmony so it never rewards scatter
 */

import { deltaE, type Oklch } from './oklch'
import { clamp } from './sampling'

export interface ScoreBreakdown {
  total: number
  contrast: number
  separation: number
  harmony: number
  focal: number
  antiMud: number
  vibrancy: number
  chromaticMass: number
  interest: number
}

const RAD = Math.PI / 180
const smooth = (x: number, a: number, b: number): number => clamp((x - a) / (b - a), 0, 1)
const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const std = (a: number[]): number => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((v) => (v - m) * (v - m))))
}
/** chroma above which a color perceptually "has a hue" (below ≈ neutral/gray). */
const CHROMATIC = 0.045

export const SCORE_WEIGHTS = {
  contrast: 0.13,
  separation: 0.12,
  harmony: 0.18,
  focal: 0.12,
  antiMud: 0.08,
  vibrancy: 0.14,
  chromaticMass: 0.12,
  interest: 0.11,
}

export function scorePalette(p: Oklch[]): ScoreBreakdown {
  if (p.length < 2) {
    return { total: 0.5, contrast: 0.5, separation: 0.5, harmony: 0.5, focal: 0.5, antiMud: 0.5, vibrancy: 0.5, chromaticMass: 0.5, interest: 0.5 }
  }
  const n = p.length
  const Ls = p.map((c) => c.L)
  const Cs = p.map((c) => c.C)
  const Hs = p.map((c) => c.H)
  const cMean = mean(Cs)
  const maxC = Math.max(...Cs)
  const csDesc = [...Cs].sort((a, b) => b - a)
  const c2 = csDesc[1] ?? 0 // second-highest chroma — a real palette has more than one color

  // contrast: reward a healthy lightness range. A dark+light pair is a soft bonus (×1), not a hard
  // gate (×0.82) — so genuinely high-key/pastel palettes are reachable instead of always penalized.
  const spread = Math.max(...Ls) - Math.min(...Ls)
  const hasDark = Ls.some((l) => l < 0.46)
  const hasLight = Ls.some((l) => l > 0.6)
  const contrast = smooth(spread, 0.22, 0.55) * (hasDark && hasLight ? 1 : 0.88)

  // separation: the closest pair must still be perceptibly different
  let minDE = Infinity
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) minDE = Math.min(minDE, deltaE(p[i], p[j]))
  const separation = smooth(minDE, 0.05, 0.18)

  // harmony: CHROMA-WEIGHTED — neutral slots read as hueless and don't vote on hue structure. Best
  // of tight (resultant Rcw→1) and evenly-spaced (gapEven). Two damps stop degenerate "harmony":
  //   • concentration: if one color hogs the chroma mass (Herfindahl→1), Rcw is trivially ~1 — damp it.
  //   • hue count: even spacing of >3 chromatic hues is rainbow scatter, not a scheme — damp gapEven.
  const sumC = Cs.reduce((a, b) => a + b, 0) || 1
  let sx = 0
  let sy = 0
  let herf = 0
  for (let i = 0; i < n; i++) {
    const w = Cs[i] / sumC
    sx += w * Math.cos(Hs[i] * RAD)
    sy += w * Math.sin(Hs[i] * RAD)
    herf += w * w
  }
  const Rcw = Math.hypot(sx, sy)
  const effChromatic = 1 / herf // effective number of chromatic voters
  const sigHues = Hs.filter((_, i) => Cs[i] > 0.03 * maxC).sort((a, b) => a - b)
  let gapEven = 0
  if (sigHues.length >= 2) {
    const gaps: number[] = []
    for (let i = 0; i < sigHues.length; i++) gaps.push((sigHues[(i + 1) % sigHues.length] - sigHues[i] + 360) % 360)
    gapEven = (1 - clamp(std(gaps) / (360 / sigHues.length), 0, 1)) * clamp(1 - (sigHues.length - 3) * 0.18, 0.4, 1)
  }
  const harmony =
    Math.max(Rcw, gapEven) * (smooth(n, 1.5, 3.5) * 0.3 + 0.7) * smooth(effChromatic, 1.3, 2.2)

  // focal: a chromatic lead WITH real support (60-30-10). Gated on a genuine second color so a lone
  // chip can't claim a perfect focal score from chroma variance alone; an all-vivid set gets a pass.
  const cv = cMean > 1e-4 ? std(Cs) / cMean : 0
  let focal = smooth(cv, 0.15, 0.5) * smooth(c2, 0.04, 0.085)
  if (cMean > 0.13 && maxC > 0.16) focal = Math.max(focal, 0.72) // all-vivid jewel/neon: whole set is the focal
  if (cMean > 0.12 && Rcw < 0.35 && cv < 0.3) focal *= 0.5
  focal = clamp(focal, 0, 1)

  // antiMud: penalize crowding the muddy mid-L weak-chroma zone (knee 0.30 so it actually fires at
  // n=6) — discounted for a DELIBERATE earthy palette (generally muted + a real non-olive pop).
  const muddy = p.filter((c) => c.L > 0.4 && c.L < 0.63 && c.C > 0.025 && c.C < 0.085).length / n
  const mutedness = clamp((0.07 - cMean) / 0.07, 0, 1)
  const hasPop = p.some((c) => c.C > 0.1 && (c.H < 35 || c.H > 115))
  const deliberate = mutedness * (hasPop ? 1 : 0.4)
  const antiMud = 1 - clamp((muddy - 0.3) / 0.5, 0, 1) * (1 - 0.6 * deliberate)

  // vibrancy: real color, rewarded all the way up to jewel intensity (ceiling 0.16, not 0.095, so a
  // neon palette out-scores a timid mid-sat one). Damps when most slots are perceptually gray.
  const grayFrac = Cs.filter((c) => c < CHROMATIC).length / n
  const vibrancy = smooth(maxC, 0.05, 0.16) * (1 - 0.6 * clamp((grayFrac - 0.34) / 0.5, 0, 1))

  // chromaticMass: how many slots genuinely carry a hue. Directly kills "one pop + a gray ramp" —
  // the dud that fooled vibrancy/focal/harmony individually. Wants roughly half-or-more colored.
  const chromaCount = Cs.filter((c) => c > CHROMATIC).length
  const chromaticMass = smooth(chromaCount, 1.8, Math.max(3, n * 0.6))

  // interest: striking variety (chroma/hue spread over raw lightness), gated by harmony so it only
  // pays for tension within a coherent scheme.
  const Lvar = clamp(std(Ls) / 0.22, 0, 1)
  const Cvar = clamp(std(Cs) / 0.1, 0, 1)
  const hueSpread = clamp(1 - Rcw, 0, 1)
  const interest = (0.15 * Lvar + 0.37 * Cvar + 0.48 * hueSpread) * smooth(harmony, 0.3, 0.6)

  const W = SCORE_WEIGHTS
  const weighted =
    W.contrast * contrast +
    W.separation * separation +
    W.harmony * harmony +
    W.focal * focal +
    W.antiMud * antiMud +
    W.vibrancy * vibrancy +
    W.chromaticMass * chromaticMass +
    W.interest * interest

  // coherence gate: an incoherent scatter (low harmony) gets multiplied down on the WHOLE total, so
  // it can't pass by maxing the other terms. And the near-black tic penalty (2+ pure darks).
  const coherenceGate = 0.65 + 0.35 * smooth(harmony, 0.42, 0.62)
  const nearBlack = p.filter((c) => c.L < 0.16 && c.C < 0.04).length
  const nearBlackPenalty = nearBlack >= 2 ? 0.85 : nearBlack >= 1 ? 0.96 : 1
  const total = weighted * coherenceGate * nearBlackPenalty

  return { total, contrast, separation, harmony, focal, antiMud, vibrancy, chromaticMass, interest }
}
