import { generatePaletteColors } from './engine'

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
 * Generate a palette of `count` colors. There are no styles or loaded palettes — the engine searches
 * a continuous procedural space (genome → score → hill-climb) and emits a quality-selected champion,
 * so every seed yields a different, always-working, always-beautiful palette. Pure and deterministic
 * for (seed, count). This is the stable public surface every consumer imports.
 */
export function generatePalette(seed: number, count: number): PaletteColor[] {
  return generatePaletteColors(seed, count)
}
