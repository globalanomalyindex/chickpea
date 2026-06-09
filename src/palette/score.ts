/**
 * Perceptual quality score for a candidate palette — the judge that makes "always beautiful" real.
 * The selector samples many genomes and emits only a high-scoring one, so quality is a property of
 * the OUTPUT, not a hope about the average draw. Every term returns 0..1 (1 = best); the total is
 * their weighted sum, times multiplicative GATES for the failure modes a weighted average cannot
 * veto (incoherence, gray-padding, perceptual duplicates, black-reading chips).
 *
 * Hardened by two adversarial audits. The first found three terms could be fooled by the SAME
 * feature (a lone vivid chip among grays scored ~0.89 because vibrancy, focal AND harmony each
 * rewarded it). The second found the counter-measures themselves had cliffs and absolute-chroma
 * biases: a C=0.046 slot counted as fully "colored" (2 pops + 4 tinted grays scored 0.985), the
 * mass/separation terms could be averaged away, and everything keyed on ABSOLUTE chroma quietly
 * favored magenta/violet — the hue region with the deepest sRGB gamut — until 86% of hero colors
 * were purple. The cures live here: fractional chromatic credit (no cliffs), gates instead of
 * weights for veto-shaped failures, and vividness judged RELATIVE to each color's own gamut
 * headroom so a fully-saturated gold or cyan competes fairly with magenta.
 *
 * Just as important: every legitimate GENRE must have its own road to a high score, or selection
 * pressure quietly collapses the engine onto the one genre the scorer secretly loves (measured: the
 * old harmony term counted COLORS, not hue clusters, so a 6-color triad was damped as "6 hues =
 * scatter" and tight-analogous palettes won 38% of seeds while pastels won 0.4%). Roads now:
 * tight hue (Rcw), evenly-spaced hue CLUSTERS (triad/tetrad), monotonic gradual hue RAMPS
 * (sunset/ocean gradients), and high-/low-key lightness keys that pass contrast on a narrower,
 * deliberate band. Terms:
 *   contrast      — a usable lightness range; deliberate high-key (pastel) and low-key (moody)
 *                   palettes pass on a narrower band instead of being stretched into one genre
 *   separation    — every pair perceptually distinct (also a gate on the total)
 *   harmony       — chroma-weighted hue structure: tight OR evenly-spaced clusters OR a clean ramp,
 *                   damped when one color hogs the chroma mass or clusters scatter past a tetrad
 *   focal         — one chromatic lead WITH a real second color (60-30-10), not a lone chip
 *   antiMud       — don't crowd the brown/olive mud zone (earthy palettes discounted)
 *   vibrancy      — real color relative to each hue's own gamut headroom; all-gray loses
 *   chromaticMass — several genuinely-colored slots, fractional credit (also a gate on the total)
 *   pigment       — colors sit near their hue's NATURAL lightness (where the hue can carry the most
 *                   chroma: yellow lives light, blue lives deep) — dark yellow reads as mud, and a
 *                   palette of colors "at their best lightness" reads clean. Chroma-weighted, with a
 *                   generous slack so deliberate tints/shades survive.
 *   interest      — striking variety, gated by harmony so it never rewards scatter
 */

import { deltaE, maxChroma, type Oklch } from './oklch'
import { clamp, hueDelta } from './sampling'

export interface ScoreBreakdown {
  total: number
  contrast: number
  separation: number
  harmony: number
  focal: number
  antiMud: number
  vibrancy: number
  chromaticMass: number
  pigment: number
  interest: number
}

const RAD = Math.PI / 180
const smooth = (x: number, a: number, b: number): number => clamp((x - a) / (b - a), 0, 1)
const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const std = (a: number[]): number => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((v) => (v - m) * (v - m))))
}
/** chroma around which a color transitions from neutral to "has a hue" — always used as a RAMP
 * (fractional credit via smooth), never as a hard count: a C=0.046 slot is ~20% of a color, and an
 * audit showed a hard cutoff here let "2 pops + 4 tinted grays" outscore every real palette. */
const CHROMATIC = 0.045

/** Hues within this many CONSECUTIVE degrees chain into the same family… */
const CLUSTER_DEG = 26
/** …but a chain stops growing past this total width: three vivid hues smeared over ~50° are not
 * one family pretending, and unbounded chaining let two such smears impersonate a complementary
 * pair (audit: gapEven ≈ 1 for a six-hue clash spanning 130°). */
const CLUSTER_SPAN = 42

/**
 * Each hue's NATURAL lightness — the L where sRGB can carry the most chroma for that hue (yellow
 * peaks near-white, blue deep). 36-bin lookup computed once at module load; `loptFor` interpolates.
 * This is the ground truth behind the pigment term: a vivid color far from its natural L is fighting
 * its own gamut (dark yellow → olive mud), and the eye reads the strain.
 */
const LOPT: number[] = (() => {
  const out: number[] = []
  for (let bin = 0; bin < 36; bin++) {
    let bestL = 0.5
    let bestC = 0
    for (let li = 0; li <= 18; li++) {
      const L = 0.08 + (li / 18) * 0.86
      const c = maxChroma(L, bin * 10)
      if (c > bestC) {
        bestC = c
        bestL = L
      }
    }
    out.push(bestL)
  }
  return out
})()

/** Natural lightness for an arbitrary hue (circular linear interpolation over the 36-bin LUT). */
export function loptFor(H: number): number {
  const x = (((H % 360) + 360) % 360) / 10
  const i = Math.floor(x) % 36
  const t = x - Math.floor(x)
  return LOPT[i] * (1 - t) + LOPT[(i + 1) % 36] * t
}

/** Merge chromatic hues into families (circular greedy, CLUSTER_DEG link / CLUSTER_SPAN width) and
 * return the chroma-weighted center of each — the unit "harmony" should reason about. */
export function hueClusters(items: { H: number; C: number }[]): number[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => a.H - b.H)
  const groups: { H: number; C: number }[][] = [[sorted[0]]]
  let start = sorted[0].H
  for (let i = 1; i < sorted.length; i++) {
    const g = groups[groups.length - 1]
    if (sorted[i].H - g[g.length - 1].H <= CLUSTER_DEG && sorted[i].H - start <= CLUSTER_SPAN) {
      g.push(sorted[i])
    } else {
      groups.push([sorted[i]])
      start = sorted[i].H
    }
  }
  // wrap-around: the last cluster may continue into the first across 0°, same width bound
  if (groups.length > 1) {
    const first = groups[0]
    const last = groups[groups.length - 1]
    const gap = 360 - last[last.length - 1].H + first[0].H
    const span = 360 - last[0].H + first[first.length - 1].H
    if (gap <= CLUSTER_DEG && span <= CLUSTER_SPAN) {
      groups[0] = [...last, ...first]
      groups.pop()
    }
  }
  return groups.map((g) => {
    let sx = 0
    let sy = 0
    for (const it of g) {
      sx += it.C * Math.cos(it.H * RAD)
      sy += it.C * Math.sin(it.H * RAD)
    }
    let h = (Math.atan2(sy, sx) * 180) / Math.PI
    if (h < 0) h += 360
    return h
  })
}

export const SCORE_WEIGHTS = {
  contrast: 0.12,
  separation: 0.11,
  harmony: 0.17,
  focal: 0.11,
  antiMud: 0.07,
  vibrancy: 0.13,
  chromaticMass: 0.11,
  pigment: 0.07,
  interest: 0.11,
}

export function scorePalette(p: Oklch[]): ScoreBreakdown {
  if (p.length < 2) {
    return { total: 0.5, contrast: 0.5, separation: 0.5, harmony: 0.5, focal: 0.5, antiMud: 0.5, vibrancy: 0.5, chromaticMass: 0.5, pigment: 0.5, interest: 0.5 }
  }
  const n = p.length
  const Ls = p.map((c) => c.L)
  const Cs = p.map((c) => c.C)
  const Hs = p.map((c) => c.H)
  const cMean = mean(Cs)
  const maxC = Math.max(...Cs)
  const csDesc = [...Cs].sort((a, b) => b - a)
  const c2 = csDesc[1] ?? 0 // second-highest chroma — a real palette has more than one color

  // per-color gamut headroom + RELATIVE saturation. Judging vividness against each hue's own
  // ceiling is what makes the scorer hue-fair: magenta's sRGB headroom (~0.32) dwarfs gold's
  // (~0.16), and every absolute-chroma comparison silently funnels selection toward purple.
  const heads = p.map((c) => maxChroma(c.L, c.H))
  const rels = p.map((_, i) => (heads[i] > 0.02 ? clamp(Cs[i] / heads[i], 0, 1) : 0))

  // contrast: reward a healthy lightness range — but a deliberate KEY is its own road. A palette
  // that lives entirely light (pastel/high-key) or entirely dark (moody/neon-void) reads as a
  // statement, not a failure; it passes on a narrower band so the genre survives selection. The
  // low-key credit scales with the top slot reaching a "dark cream" — an all-near-black stack of
  // swatches is not a key, it's a void.
  const spread = Math.max(...Ls) - Math.min(...Ls)
  const minL = Math.min(...Ls)
  const maxL = Math.max(...Ls)
  const hasDark = Ls.some((l) => l < 0.46)
  const hasLight = Ls.some((l) => l > 0.6)
  const fullRange = smooth(spread, 0.22, 0.55) * (hasDark && hasLight ? 1 : 0.88)
  const highKey = minL > 0.52 ? smooth(spread, 0.1, 0.26) * 0.94 : 0
  const lowKey =
    maxL < 0.52 ? smooth(spread, 0.1, 0.26) * 0.96 * (0.7 + 0.3 * smooth(maxL, 0.34, 0.44)) : 0
  const contrast = Math.max(fullRange, highKey, lowKey)

  // separation: the closest pair must still be perceptibly different. The floor (0.05) never moves;
  // the FULL-CREDIT knee relaxes for an all-dark palette because dark colors sit physically closer
  // in OKLab — demanding mid-L distances down there was the third hidden bias against the moody key.
  let minDE = Infinity
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) minDE = Math.min(minDE, deltaE(p[i], p[j]))
  const separation = smooth(minDE, 0.05, maxL < 0.52 ? 0.13 : 0.18)

  // harmony: CHROMA-WEIGHTED — neutral slots read as hueless and don't vote on hue structure.
  // Best of three roads, damped when one color hogs the chroma mass (Herfindahl→1 makes Rcw
  // trivially ~1):
  //   tight   — resultant Rcw→1 (mono/analogous)
  //   even    — hue CLUSTERS evenly spaced (complementary/triad/tetrad). Clusters, not colors:
  //             a 6-color triad is 3 families. >4 families is genuine scatter and damps.
  //   ramp    — hue travels MONOTONICALLY and GRADUALLY with lightness (sunset/ocean/foliage).
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
  // cluster voters need REAL chroma (absolute floor): with only a relative floor, near-invisible
  // tints voted with their stored hue and propped up "harmony" for gray-padded duds
  const chromaticIdx = p.map((_, i) => i).filter((i) => Cs[i] > Math.max(0.035, 0.03 * maxC))
  const clusters = hueClusters(chromaticIdx.map((i) => ({ H: Hs[i], C: Cs[i] }))).sort((a, b) => a - b)
  const k = clusters.length
  let gapEven = 0
  if (k >= 2) {
    const gaps: number[] = []
    for (let i = 0; i < k; i++) gaps.push((clusters[(i + 1) % k] - clusters[i] + 360) % 360)
    // 2-3 families undamped; a tetrad is legitimate but slightly busy at studio counts, and a
    // FULL-SATURATION tetrad is garish — the damp deepens with chroma mass; 5+ is genuine scatter
    const famDamp =
      k <= 3 ? 1 : k === 4 ? 0.9 - 0.15 * smooth(cMean, 0.12, 0.2) : clamp(1 - (k - 4) * 0.3, 0.4, 0.9)
    gapEven = (1 - clamp(std(gaps) / (360 / k), 0, 1)) * famDamp
  }
  // ramp road: chromatic colors sorted by lightness; monotone signed hue travel = a gradient.
  // Gradual is part of the definition: 40°+ single steps are a wheel tour, not a gradient, and
  // chroma that zigzags along the ladder breaks the read even when the hues line up.
  let ramp = 0
  if (chromaticIdx.length >= 4) {
    const byL = [...chromaticIdx].sort((a, b) => Ls[a] - Ls[b])
    let signed = 0
    let total = 0
    let maxStep = 0
    let rough = 0
    for (let i = 1; i < byL.length; i++) {
      const d = hueDelta(Hs[byL[i - 1]], Hs[byL[i]])
      signed += d
      total += Math.abs(d)
      maxStep = Math.max(maxStep, Math.abs(d))
      rough += Math.abs(Cs[byL[i]] - Cs[byL[i - 1]])
    }
    rough /= byL.length - 1
    const span = Math.abs(signed)
    const mono = total > 1e-6 ? span / total : 0
    // capped at 0.86 (not ~1): a ramp must also win on the other terms, or selection converts
    // every seed into a sunset — the same monoculture pressure measured for tight-analogous before.
    ramp =
      mono * mono * smooth(span, 30, 80) * (1 - smooth(span, 220, 320)) *
      (1 - smooth(maxStep, 38, 60)) * (1 - 0.6 * smooth(rough, 0.05, 0.1)) * 0.86
  }
  const harmony =
    Math.max(Rcw, gapEven, ramp) * (smooth(n, 1.5, 3.5) * 0.3 + 0.7) * smooth(effChromatic, 1.5, 2.5)

  // focal: a chromatic lead WITH real support (60-30-10). Gated on a genuine second color so a lone
  // chip can't claim a perfect focal score from chroma variance alone; an all-vivid set gets a pass
  // (judged absolutely OR relatively, so an all-saturated gold/teal set counts as jewel too).
  const relMean = mean(rels)
  const maxRel = Math.max(...rels)
  const cv = cMean > 1e-4 ? std(Cs) / cMean : 0
  let focal = smooth(cv, 0.15, 0.5) * smooth(c2, 0.04, 0.085)
  // up to 3 families: a whole-set jewel/neon reads as one statement; at 4+ vivid families the
  // "set as focal" claim is just loudness (audit: a garish tetrad rode this floor past the mean)
  if (k <= 3 && ((cMean > 0.13 && maxC > 0.16) || (relMean > 0.6 && maxRel > 0.8 && cMean > 0.09))) {
    focal = Math.max(focal, 0.72)
  }
  // a deliberate KEY or a clean ramp is naturally even in chroma — its focal point is the key/the
  // travel itself. The pass scales with harmony: structure earns it, an unstructured dark stack
  // doesn't (audit: the flat 0.6 let zigzag navy junk stack every key allowance at once).
  const structured = smooth(harmony, 0.45, 0.7)
  if ((minL > 0.52 || maxL < 0.52) && cMean > 0.055 && maxC > 0.09) focal = Math.max(focal, 0.6 * structured)
  if (ramp > 0.6 && cMean > 0.07) focal = Math.max(focal, 0.6 * structured)
  if (cMean > 0.12 && Rcw < 0.35 && cv < 0.3) focal *= 0.5
  focal = clamp(focal, 0, 1)

  // antiMud: penalize crowding the muddy mid-L weak-chroma zone — SOFT membership (a color half a
  // hair outside a hard box is not suddenly clean) — discounted for a DELIBERATE earthy palette
  // (generally muted + a real non-olive pop) or a low-key palette whose upper slots graze the zone.
  const mudShare = mean(
    p.map((c) => {
      const inL = smooth(c.L, 0.37, 0.43) * (1 - smooth(c.L, 0.6, 0.66))
      const inC = smooth(c.C, 0.02, 0.03) * (1 - smooth(c.C, 0.08, 0.095))
      return inL * inC
    }),
  )
  const mutedness = clamp((0.07 - cMean) / 0.07, 0, 1)
  const hasPop = p.some((c) => c.C > 0.1 && (c.H < 35 || c.H > 115))
  const deliberate = Math.max(mutedness * (hasPop ? 1 : 0.4), maxL < 0.52 ? 0.75 : 0)
  const antiMud = 1 - clamp((mudShare - 0.3) / 0.5, 0, 1) * (1 - 0.6 * deliberate)

  // vibrancy: the most-saturated slot judged against ITS OWN headroom, with a real-chroma ramp so
  // a "fully saturated" near-neutral can't claim it. Hue-fair by construction (gold C 0.15 of 0.16
  // beats magenta C 0.2 of 0.32) and lightness-fair (a jewel-dark 0.12 at a dark slot's 0.13
  // ceiling reads vivid down there). Damps when most slots are perceptually gray.
  const grayFrac = mean(Cs.map((c) => 1 - smooth(c, 0.04, 0.075)))
  const grayDamp = 1 - 0.6 * clamp((grayFrac - 0.34) / 0.5, 0, 1)
  let maxVivid = 0
  for (let i = 0; i < n; i++) maxVivid = Math.max(maxVivid, rels[i] * smooth(Cs[i], 0.045, 0.11))
  const vibrancy = maxVivid * grayDamp

  // chromaticMass: how many slots genuinely carry a hue — FRACTIONAL credit (no cliff at the
  // neutral boundary), and a gate on the total below so it cannot be averaged away.
  const chromaCount = Cs.reduce((s, c) => s + smooth(c, 0.04, 0.075), 0)
  const chromaticMass = smooth(chromaCount, 1.8, Math.max(3, n * 0.6))

  // pigment: chromatic colors near their hue's natural lightness read clean; far from it they fight
  // the gamut (dark yellow = olive, blazing-light deep blue = chalk). Chroma-weighted — the more
  // color a slot carries, the more its placement matters — with slack wide enough that deliberate
  // tints and shades pass untouched. Neutral palettes are unopinionated (0.75).
  let pigSum = 0
  let pigW = 0
  for (const c of p) {
    if (c.C <= CHROMATIC) continue
    const align = 1 - smooth(Math.abs(c.L - loptFor(c.H)), 0.18, 0.5)
    pigSum += c.C * align
    pigW += c.C
  }
  const pigment = pigW > 0 ? pigSum / pigW : 0.75

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
    W.pigment * pigment +
    W.interest * interest

  // gates: failure modes that must be able to VETO, because at ~0.11 weight a term reading 0.2 only
  // costs ~0.09 of a weighted sum the other eight terms happily pay (audit: three real duds passed
  // exactly this way).
  //   coherence — incoherent scatter can't pass by maxing the other terms
  //   mass      — one or two pops padded with gray dust isn't a palette
  //   sep       — perceptual near-duplicates aren't bought back by variety elsewhere
  // Plus the black-tic penalty: judged on the RENDERED color (OKLab distance from true black) —
  // numeric chroma a dark slot cannot actually display used to hide black-reading chips.
  const coherenceGate = 0.65 + 0.35 * smooth(harmony, 0.42, 0.62)
  const massGate = 0.78 + 0.22 * smooth(chromaticMass, 0.3, 0.7)
  const sepGate = 0.8 + 0.2 * smooth(minDE, 0.055, maxL < 0.52 ? 0.085 : 0.1) // dark knee, like the term
  const nearBlack = p.filter((_, i) => Math.hypot(Ls[i], Math.min(Cs[i], heads[i])) < 0.21).length
  const nearBlackPenalty = nearBlack >= 2 ? 0.85 : nearBlack >= 1 ? 0.96 : 1
  const total = weighted * coherenceGate * massGate * sepGate * nearBlackPenalty

  return { total, contrast, separation, harmony, focal, antiMud, vibrancy, chromaticMass, pigment, interest }
}
