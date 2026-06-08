import { describe, it, expect } from 'vitest'
import { imagePaletteToPalette } from './imagePalette'
import { buildComposition } from './composition'
import { buildAnchoredGrid } from '../grid/anchor'

describe('imagePaletteToPalette', () => {
  const colors = [
    { rgb: [200, 40, 90] as [number, number, number], weight: 50 },
    { rgb: [12, 180, 60] as [number, number, number], weight: 20 },
    { rgb: [78, 106, 122] as [number, number, number], weight: 8 },
  ]

  it('wraps ColorWeight into the PaletteColor shape (hex + hsl + weight)', () => {
    const pal = imagePaletteToPalette(colors)
    expect(pal.length).toBe(3)
    expect(pal[0].hex).toBe('#c8285a')
    expect(pal[0].rgb).toEqual([200, 40, 90])
    expect(pal[0].weight).toBe(50)
    // h/s/l populated and in range
    for (const c of pal) {
      expect(c.h).toBeGreaterThanOrEqual(0)
      expect(c.h).toBeLessThan(360)
      expect(c.s).toBeGreaterThanOrEqual(0)
      expect(c.l).toBeGreaterThanOrEqual(0)
    }
  })

  it('feeds buildComposition unchanged (consumed like a generated palette)', () => {
    const pal = imagePaletteToPalette(colors)
    const grid = buildAnchoredGrid([{ axis: 'v', pos: 0.5 }], 1)
    const comp = buildComposition(grid, pal, { seed: 1, textChance: 0 })
    expect(comp.modules.length).toBe(grid.modules.length)
    expect(comp.background).toBe(pal[pal.length - 1].hex)
    // every module got a color from the palette
    const hexes = new Set(pal.map((c) => c.hex))
    for (const m of comp.modules) expect(hexes.has(m.color)).toBe(true)
  })
})
