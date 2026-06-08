import { mulberry32, pick, type Rng } from '../grid/prng'
import type { Grid, Module } from '../grid/types'
import type { PaletteColor } from '../palette/generate'

export interface CompModule {
  module: Module
  color: string
  text: string | null
}
export interface Composition {
  background: string
  modules: CompModule[]
}

const WORDS = ['grid', 'phi', 'root', 'seed', 'leaf', 'ratio', 'field', 'form', 'order', 'grow']

export function buildComposition(
  grid: Grid,
  palette: PaletteColor[],
  opts: { seed: number; textChance?: number },
): Composition {
  const rng: Rng = mulberry32(opts.seed ^ 0x51ed)
  const textChance = opts.textChance ?? 0
  // order modules by area desc so dominant color lands on the largest
  const order = grid.modules
    .map((module, i) => ({ module, i }))
    .sort((a, b) => b.module.w * b.module.h - a.module.w * a.module.h)
  const colored: CompModule[] = new Array(grid.modules.length)
  order.forEach((entry, rank) => {
    const color = palette[Math.min(rank, palette.length - 1)].hex
    const text = rng() < textChance ? pick(rng, WORDS) : null
    colored[entry.i] = { module: entry.module, color, text }
  })
  const background = palette[palette.length - 1].hex
  return { background, modules: colored }
}
