import { generatePaletteColors } from './engine'
import type { PaletteStyle } from './engine'

/**
 * A finished palette color. `hex`/`rgb` are the gamut-mapped sRGB the composition renders; `h/s/l`
 * are the HSL of that final color, kept truthful for the reveal annotations; `weight` is its share
 * (descending, hero first) used by the dyadic layout and to order module fills.
 */
export interface PaletteColor {
  hex: string
  rgb: [number, number, number]
  h: number
  s: number
  l: number
  weight: number
}

/**
 * Generate a palette of `count` colors in a given mood/`style` (default `auto` = a seeded surprise
 * recipe). Pure and deterministic for (seed, count, style). The real work lives in the OKLCH engine
 * (`./engine`) and the mood recipes (`./recipes`); this is the stable public surface every consumer
 * imports, so the revamp didn't ripple through composition/export/studio call sites.
 */
export function generatePalette(seed: number, count: number, style: PaletteStyle = 'auto'): PaletteColor[] {
  return generatePaletteColors(seed, count, style)
}
