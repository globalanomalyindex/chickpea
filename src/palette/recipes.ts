/**
 * The mood library — each recipe is a seeded function (rng, count) → OKLCH[] with a distinct
 * identity. Recipes deliberately do NOT worry about gamut, legibility, dedupe or ordering: the
 * engine's harmonizer enforces those invariants afterward, so a recipe is free to express its
 * vibe (max-punch graphic, all-light pastel, chaotic random) without bookkeeping. They only owe
 * one thing: produce `count` colors that *belong together*.
 *
 * Two construction strategies appear here:
 *   - structural moods (graphic, jewel, neon, pastel, vintage, mono, earthy, random) build colors
 *     from a hue scheme + lightness ladder + chroma band tuned to the mood;
 *   - source moods (botanical, fauna, nature) perturb a curated real-world anchor set.
 */

import { type Rng } from '../grid/prng'
import type { Oklch } from './oklch'
import { rgbToOklch } from './oklch'
import { hexToRgb } from './hsl'
import { CURATED, type CuratedCategory } from './curated'

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const wrapHue = (h: number): number => ((h % 360) + 360) % 360
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** symmetric jitter in ±amt */
const jit = (rng: Rng, amt: number): number => (rng() * 2 - 1) * amt
const pickIn = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]
const range = (rng: Rng, lo: number, hi: number): number => lo + rng() * (hi - lo)

// ---- shared building blocks ----

type Scheme = 'mono' | 'analogous' | 'complement' | 'split' | 'triad' | 'tetrad'

/** Anchor hue offsets per scheme; recipes index into these and cycle for higher counts. */
const SCHEME_OFFSETS: Record<Scheme, number[]> = {
  mono: [0, 0, 0, 0, 0, 0],
  analogous: [0, 20, -20, 38, -38, 14],
  complement: [0, 180, 18, 198, -18, 162],
  split: [0, 152, 208, 24, 176, 332],
  triad: [0, 120, 240, 60, 180, 300],
  tetrad: [0, 90, 180, 270, 45, 225],
}

/** `count` hues around `baseH` following a scheme, with per-color hue jitter. */
function schemeHues(rng: Rng, baseH: number, scheme: Scheme, count: number, jitter = 7): number[] {
  const off = SCHEME_OFFSETS[scheme]
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(wrapHue(baseH + off[i % off.length] + jit(rng, jitter)))
  return out
}

/** `count` lightness values laddered lo→hi with jitter (index order ascending). */
function ladder(rng: Rng, count: number, lo: number, hi: number, jitter: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    out.push(clamp01(lerp(lo, hi, t) + jit(rng, jitter)))
  }
  return out
}

// ---- structural moods ----

/** Bold poster graphics: vivid, wide lightness spread, few well-related hues. Bauhaus energy. */
function graphic(rng: Rng, count: number): Oklch[] {
  const base = rng() * 360
  const scheme = pickIn(rng, ['triad', 'complement', 'split', 'tetrad'] as const)
  const hues = schemeHues(rng, base, scheme, count, 6)
  const Ls = ladder(rng, count, 0.4, 0.88, 0.05)
  return hues.map((H, i) => ({ L: Ls[i], C: range(rng, 0.15, 0.24), H }))
}

/** Earthy neutrals — beiges, taupes, clay — grounded by one or two brighter accents. */
function earthy(rng: Rng, count: number): Oklch[] {
  const warm = range(rng, 18, 70) // ochre/umber band
  const accents = count >= 5 ? 2 : count >= 3 ? 1 : 0
  const neutrals = count - accents
  const out: Oklch[] = []
  const Ln = ladder(rng, neutrals, 0.34, 0.9, 0.04)
  for (let i = 0; i < neutrals; i++) {
    out.push({ L: Ln[i], C: range(rng, 0.012, 0.05), H: wrapHue(warm + jit(rng, 12)) })
  }
  // accents: a warmer-pop or a complementary olive/teal/rust against the neutrals
  for (let i = 0; i < accents; i++) {
    const dir = pickIn(rng, [warm + 8, warm + 150, warm + 170, warm - 30])
    out.push({ L: range(rng, 0.5, 0.7), C: range(rng, 0.1, 0.16), H: wrapHue(dir + jit(rng, 10)) })
  }
  return out
}

/** Deep gemstones: dark-to-mid lightness, rich chroma, harmonious across the wheel. */
function jewel(rng: Rng, count: number): Oklch[] {
  const base = rng() * 360
  const scheme = pickIn(rng, ['split', 'triad', 'tetrad', 'analogous'] as const)
  const hues = schemeHues(rng, base, scheme, count, 8)
  return hues.map((H, i) => {
    const sparkle = i === count - 1 && count >= 4 && rng() < 0.6 // occasional bright facet
    return sparkle
      ? { L: range(rng, 0.82, 0.92), C: range(rng, 0.06, 0.12), H }
      : { L: range(rng, 0.36, 0.6), C: range(rng, 0.13, 0.2), H }
  })
}

/** Electric neon: a near-black base plus high-chroma light pops in the cyan/magenta/lime arc. */
function neon(rng: Rng, count: number): Oklch[] {
  const base = rng() * 360
  const scheme = pickIn(rng, ['triad', 'tetrad', 'complement'] as const)
  const hues = schemeHues(rng, base, scheme, count, 9)
  return hues.map((H, i) => {
    if (i === 0) return { L: range(rng, 0.16, 0.26), C: range(rng, 0.02, 0.05), H } // void base
    return { L: range(rng, 0.72, 0.86), C: range(rng, 0.16, 0.26), H }
  })
}

/** Soft pastels: high-key, low chroma, airy — with one slightly deeper tone for footing. */
function pastel(rng: Rng, count: number): Oklch[] {
  const base = rng() * 360
  const scheme = pickIn(rng, ['analogous', 'complement', 'split'] as const)
  const hues = schemeHues(rng, base, scheme, count, 10)
  return hues.map((H, i) => {
    if (i === 0 && count >= 3) return { L: range(rng, 0.56, 0.66), C: range(rng, 0.05, 0.09), H }
    return { L: range(rng, 0.84, 0.94), C: range(rng, 0.035, 0.075), H }
  })
}

/** Faded vintage print: muted, desaturated, warm-shifted — analogous and nostalgic. */
function vintage(rng: Rng, count: number): Oklch[] {
  const base = range(rng, 20, 110) // warm/yellow cast
  const hues = schemeHues(rng, base, 'analogous', count, 12)
  const Ls = ladder(rng, count, 0.4, 0.82, 0.05)
  return hues.map((H, i) => ({ L: Ls[i], C: range(rng, 0.035, 0.085), H: wrapHue(H - 4) }))
}

/** Monochrome / duotone: one hue (or two adjacent) across a full lightness ladder. Quietly elegant. */
function mono(rng: Rng, count: number): Oklch[] {
  const base = rng() * 360
  const second = rng() < 0.45 ? base + (rng() < 0.5 ? 1 : -1) * range(rng, 18, 34) : base
  const Ls = ladder(rng, count, 0.22, 0.93, 0.03)
  return Ls.map((L, i) => {
    const H = wrapHue((i % 2 === 0 ? base : second) + jit(rng, 4))
    // chroma peaks in the mid-lightness, fades toward the ends (the gray extremes)
    const C = range(rng, 0.05, 0.14) * (1 - Math.abs(L - 0.55) / 0.55)
    return { L, C: Math.max(0.01, C), H }
  })
}

/** True chaos — every color independent — relying on the harmonizer to make it cohere and read. */
function random(rng: Rng, count: number): Oklch[] {
  const out: Oklch[] = []
  for (let i = 0; i < count; i++) {
    out.push({ L: range(rng, 0.24, 0.92), C: range(rng, 0.03, 0.22), H: rng() * 360 })
  }
  return out
}

// ---- source moods (curated anchor + seeded perturbation) ----

/** Pick `count` colors spread across a curated set's index range (always includes its hero, idx 0). */
function selectSpread(base: Oklch[], count: number, rng: Rng): Oklch[] {
  const n = base.length
  if (count <= n) {
    const out: Oklch[] = []
    for (let i = 0; i < count; i++) out.push(base[Math.round((i * (n - 1)) / Math.max(1, count - 1))])
    return out
  }
  // need more than the set has: take all, then add perturbed interpolations between random pairs
  const out = base.slice()
  while (out.length < count) {
    const a = base[Math.floor(rng() * n)]
    const b = base[Math.floor(rng() * n)]
    const t = range(rng, 0.3, 0.7)
    out.push({ L: lerp(a.L, b.L, t), C: lerp(a.C, b.C, t), H: a.H }) // hue from a keeps it on-theme
  }
  return out
}

function curatedMood(category: CuratedCategory) {
  return (rng: Rng, count: number): Oklch[] => {
    const set = pickIn(rng, CURATED[category])
    const base = set.colors.map((hex) => rgbToOklch(hexToRgb(hex)))
    return selectSpread(base, count, rng).map((c) => ({
      L: clamp01(c.L + jit(rng, 0.035)),
      C: Math.max(0, c.C * (1 + jit(rng, 0.14))),
      H: wrapHue(c.H + jit(rng, 6)),
    }))
  }
}

// ---- registry ----

export type PaletteStyle =
  | 'auto'
  | 'graphic'
  | 'earthy'
  | 'nature'
  | 'botanical'
  | 'fauna'
  | 'jewel'
  | 'neon'
  | 'pastel'
  | 'vintage'
  | 'mono'
  | 'random'

export type ConcreteStyle = Exclude<PaletteStyle, 'auto'>

/** All concrete moods, in the order they appear in the UI (after `auto`). */
export const CONCRETE_STYLES: ConcreteStyle[] = [
  'graphic',
  'earthy',
  'nature',
  'botanical',
  'fauna',
  'jewel',
  'neon',
  'pastel',
  'vintage',
  'mono',
  'random',
]

export const RECIPES: Record<ConcreteStyle, (rng: Rng, count: number) => Oklch[]> = {
  graphic,
  earthy,
  nature: curatedMood('landscape'),
  botanical: curatedMood('botanical'),
  fauna: curatedMood('fauna'),
  jewel,
  neon,
  pastel,
  vintage,
  mono,
  random,
}
