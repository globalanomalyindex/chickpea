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
  // order modules by area desc so the dominant color lands on the largest module
  const order = grid.modules
    .map((module, i) => ({ module, i }))
    .sort((a, b) => b.module.w * b.module.h - a.module.w * a.module.h)
  const colored: CompModule[] = new Array(grid.modules.length)

  // Largest module gets the dominant color. The rest are seed-shuffled and the full
  // palette is cycled across them, so any module count (a 6-cell golden grid or a
  // 120-cell modular grid) yields a balanced, spread, multi-colour composition rather
  // than collapsing every extra cell onto the last palette colour.
  const [largest, ...rest] = order
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  if (largest) colored[largest.i] = { module: largest.module, color: palette[0].hex, text: null }
  rest.forEach((entry, i) => {
    colored[entry.i] = { module: entry.module, color: palette[(i + 1) % palette.length].hex, text: null }
  })

  // Text lands on a seeded sparse subset, in stable module order (independent of colour).
  for (let i = 0; i < colored.length; i++) {
    if (rng() < textChance) colored[i].text = pick(rng, WORDS)
  }

  const background = palette[palette.length - 1].hex
  return { background, modules: colored }
}
