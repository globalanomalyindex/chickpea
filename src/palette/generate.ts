import { mulberry32, pick, type Rng } from '../grid/prng'
import { hslToRgb, rgbToHex } from './hsl'

export interface PaletteColor {
  hex: string
  rgb: [number, number, number]
  h: number
  s: number
  l: number
  weight: number
}

// botanical / earth / mineral hue anchors (degrees)
const NATURE_HUES = [28, 42, 86, 122, 158, 196, 18, 348]
const SCHEMES: number[][] = [
  [0, 18, -18, 36, -36, 54], // analogous
  [0, 180, 12, 168, -12, 192], // complementary pairs
  [0, 120, 240, 24, 144, 264], // triad
]

export function generatePalette(seed: number, count: number): PaletteColor[] {
  const rng: Rng = mulberry32(seed)
  const baseH = pick(rng, NATURE_HUES) + (rng() * 16 - 8)
  const scheme = pick(rng, SCHEMES)
  const out: PaletteColor[] = []
  for (let i = 0; i < count; i++) {
    const h = baseH + scheme[i % scheme.length] + (rng() * 10 - 5)
    const s = 0.18 + rng() * 0.4 // 0.18..0.58 muted
    const l = 0.32 + (i / Math.max(1, count - 1)) * 0.5 + (rng() * 0.06 - 0.03) // spread dark->light
    const rgb = hslToRgb(h, s, Math.max(0.08, Math.min(0.92, l)))
    out.push({ hex: rgbToHex(rgb), rgb, h: ((h % 360) + 360) % 360, s, l, weight: count - i })
  }
  return out
}
