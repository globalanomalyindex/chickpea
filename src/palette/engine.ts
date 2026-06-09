/**
 * Palette engine — turns (seed, count, style) into a finished, always-usable palette.
 *
 * Pipeline: pick a mood recipe (style, or a seeded surprise when style is 'auto') → run it → then
 * the HARMONIZER enforces the invariants that make any palette "always work" regardless of how wild
 * the recipe was:
 *   1. fitCount      — exactly `count` colors (interpolate up / trim down)
 *   2. enforceSpread — guarantee a minimum lightness range so a composition always has a light, a
 *                      dark, and a usable background to choose from
 *   3. dedupe        — nudge apart colors that are perceptually identical (wasted palette slots)
 *   4. orderHeroFirst— index 0 = the most "hero" color (vivid + well-lit); the dominant module
 *                      gets it. Remaining colors follow by descending chroma.
 * Only after that does it convert to sRGB via hue-preserving gamut mapping. The recipe expresses
 * the vibe; the harmonizer makes it correct.
 */

import { mulberry32, type Rng } from '../grid/prng'
import { gamutMapToRgb, deltaE, type Oklch } from './oklch'
import { rgbToHex, rgbToHsl } from './hsl'
import type { PaletteColor } from './generate'
import { RECIPES, CONCRETE_STYLES, type PaletteStyle, type ConcreteStyle } from './recipes'

export type { PaletteStyle, ConcreteStyle } from './recipes'
export { CONCRETE_STYLES } from './recipes'

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const wrapHue = (h: number): number => ((h % 360) + 360) % 360

/** Every style the picker offers, `auto` first. */
export const PALETTE_STYLES: PaletteStyle[] = ['auto', ...CONCRETE_STYLES]

const MIN_LIGHTNESS_SPREAD = 0.42
const DEDUPE_DELTA = 0.055

/** Force the array to exactly `count` colors: interpolate new ones between neighbors, or trim. */
function fitCount(cs: Oklch[], count: number, rng: Rng): Oklch[] {
  if (cs.length === count) return cs
  if (cs.length > count) return cs.slice(0, count)
  if (cs.length === 0) return cs
  const out = cs.slice()
  while (out.length < count) {
    const i = Math.floor(rng() * (out.length - 1 || 1))
    const a = out[i]
    const b = out[Math.min(out.length - 1, i + 1)]
    const t = 0.4 + rng() * 0.2
    out.push({ L: lerp(a.L, b.L, t), C: lerp(a.C, b.C, t), H: a.H })
  }
  return out
}

/**
 * Guarantee the lightness range spans at least MIN_LIGHTNESS_SPREAD by linearly stretching L around
 * the palette's midpoint (clamped to a printable band). Stretching in OKLCH is perceptually even,
 * so the mood survives — a too-flat pastel just gains a little footing, not a personality transplant.
 */
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

/**
 * Nudge apart any colors that are perceptually the same (a small ΔE), so no palette slot is wasted.
 * Each color is moved until it clears EVERY other color (not just earlier ones), so a nudge can't
 * silently re-collide with a color it already passed. Only hue and chroma move — lightness is left
 * untouched so the spread `enforceSpread` just guaranteed survives.
 */
function dedupe(cs: Oklch[]): Oklch[] {
  const out = cs.map((c) => ({ ...c }))
  for (let i = 0; i < out.length; i++) {
    let guard = 0
    while (guard++ < 12) {
      const collides = out.some((o, j) => j !== i && deltaE(out[i], o) < DEDUPE_DELTA)
      if (!collides) break
      out[i] = { L: out[i].L, C: Math.min(0.26, out[i].C + 0.02), H: wrapHue(out[i].H + 26) }
    }
  }
  return out
}

/** "Hero-ness": vivid AND well-lit (mid lightness). Peaks around L≈0.6, scales with chroma. */
function heroScore(c: Oklch): number {
  const midL = 1 - Math.abs(c.L - 0.6) / 0.6
  return c.C * (0.35 + 0.65 * clamp01(midL))
}

/** Hero color first (the dominant module's fill); the rest by descending chroma for a lively order. */
function orderHeroFirst(cs: Oklch[]): Oklch[] {
  if (cs.length < 2) return cs
  let hi = 0
  for (let i = 1; i < cs.length; i++) if (heroScore(cs[i]) > heroScore(cs[hi])) hi = i
  const hero = cs[hi]
  const rest = cs.filter((_, i) => i !== hi).sort((a, b) => b.C - a.C)
  return [hero, ...rest]
}

/** The seeded RNG that drives a palette. Shared by the generator and `resolveStyle` so the recipe
 * `auto` actually runs and the one `resolveStyle` reports are guaranteed identical. */
function styleRng(seed: number): Rng {
  return mulberry32((seed ^ 0x9e3779b9) >>> 0)
}

/** Which concrete mood a (seed, style) resolves to — `style` itself, or the seeded `auto` surprise.
 * Lets the UI show the recipe `auto` picked. MUST consume the rng the same way the generator does. */
export function resolveStyle(seed: number, style: PaletteStyle): ConcreteStyle {
  if (style !== 'auto') return style
  return CONCRETE_STYLES[Math.floor(styleRng(seed)() * CONCRETE_STYLES.length)]
}

/** The full harmonized OKLCH palette for (seed, count, style) — pure and deterministic. */
export function generatePaletteOklch(seed: number, count: number, style: PaletteStyle = 'auto'): Oklch[] {
  const n = Math.max(1, Math.round(count))
  const rng: Rng = styleRng(seed)
  // Always draw the surprise pick so the downstream rng stream is identical whether the user kept
  // `auto` or explicitly chose the style `auto` resolved to — picking that style reproduces the palette.
  const surprise = CONCRETE_STYLES[Math.floor(rng() * CONCRETE_STYLES.length)]
  const chosen: ConcreteStyle = style === 'auto' ? surprise : style
  let cs = RECIPES[chosen](rng, n)
  cs = fitCount(cs, n, rng)
  cs = enforceSpread(cs)
  cs = dedupe(cs)
  cs = orderHeroFirst(cs)
  return cs
}

/** Map a harmonized OKLCH palette to the studio's `PaletteColor[]` (sRGB hex + truthful HSL readout). */
export function paletteFromOklch(colors: Oklch[]): PaletteColor[] {
  return colors.map((c, i) => {
    const rgb = gamutMapToRgb(c)
    const [h, s, l] = rgbToHsl(rgb)
    return { hex: rgbToHex(rgb), rgb, h, s, l, weight: colors.length - i }
  })
}

/** Public entry: a finished sRGB palette of `count` colors in the chosen mood. */
export function generatePaletteColors(seed: number, count: number, style: PaletteStyle = 'auto'): PaletteColor[] {
  return paletteFromOklch(generatePaletteOklch(seed, count, style))
}
