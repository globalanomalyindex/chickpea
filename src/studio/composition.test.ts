import { describe, it, expect } from 'vitest'
import { buildComposition } from './composition'
import { generate } from '../grid/generators'
import { generateModular } from '../grid/generators/modular'
import { generatePalette } from '../palette/generate'

describe('buildComposition', () => {
  it('colors every module and is deterministic', () => {
    const grid = generate('recursive', 10)
    const pal = generatePalette(10, 6)
    const a = buildComposition(grid, pal, { seed: 10 })
    const b = buildComposition(grid, pal, { seed: 10 })
    expect(a.modules.length).toBe(grid.modules.length)
    expect(a.modules.every((m) => /^#[0-9a-f]{6}$/.test(m.color))).toBe(true)
    expect(a).toEqual(b)
  })

  it('gives the largest module the dominant (first) palette color', () => {
    const grid = generate('nature', 3)
    const pal = generatePalette(3, 5)
    const comp = buildComposition(grid, pal, { seed: 3 })
    const largest = comp.modules.reduce((p, c) => (c.module.w * c.module.h > p.module.w * p.module.h ? c : p))
    expect(largest.color).toBe(pal[0].hex)
  })

  it('places text on at most the requested fraction of modules', () => {
    const grid = generate('modular', 5)
    const pal = generatePalette(5, 6)
    const comp = buildComposition(grid, pal, { seed: 5, textChance: 0.25 })
    const withText = comp.modules.filter((m) => m.text).length
    expect(withText).toBeLessThanOrEqual(Math.ceil(comp.modules.length * 0.6))
  })

  it('spreads the full palette across a many-cell grid (no collapse to one colour)', () => {
    const grid = generateModular(1, { kind: 'modular', columns: 5, rows: 4, margin: 0.05, gutter: 0.02 })
    const pal = generatePalette(1, 6)
    const comp = buildComposition(grid, pal, { seed: 1 })
    expect(grid.modules.length).toBe(20)
    // every palette colour appears at least once — the grid is not mostly one colour
    expect(new Set(comp.modules.map((m) => m.color)).size).toBe(6)
  })
})
