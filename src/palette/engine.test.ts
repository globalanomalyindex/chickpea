import { describe, it, expect } from 'vitest'
import { generatePaletteColors, generatePaletteOklch, resolveStyle, PALETTE_STYLES, CONCRETE_STYLES } from './engine'
import { deltaE } from './oklch'

const isHex = (s: string) => /^#[0-9a-f]{6}$/.test(s)

describe('palette engine', () => {
  it('returns exactly `count` valid hex colors with descending weights, hero first', () => {
    for (const count of [2, 3, 5, 8, 12]) {
      const p = generatePaletteColors(99, count, 'graphic')
      expect(p.length).toBe(count)
      for (const c of p) expect(isHex(c.hex)).toBe(true)
      for (let i = 1; i < p.length; i++) expect(p[i].weight).toBeLessThanOrEqual(p[i - 1].weight)
    }
  })

  it('is deterministic for (seed, count, style)', () => {
    expect(generatePaletteColors(7, 6, 'jewel')).toEqual(generatePaletteColors(7, 6, 'jewel'))
    expect(generatePaletteColors(7, 6, 'auto')).toEqual(generatePaletteColors(7, 6, 'auto'))
  })

  it('different seeds diverge, and a style differs from auto-on-the-same-seed sometimes', () => {
    expect(generatePaletteColors(1, 6, 'neon')[0].hex).not.toBe(generatePaletteColors(2, 6, 'neon')[0].hex)
  })

  it('every concrete style produces an in-gamut, finite palette at every count', () => {
    for (const style of CONCRETE_STYLES) {
      for (const count of [2, 4, 7, 10]) {
        const p = generatePaletteColors(count * 31 + 5, count, style)
        expect(p.length).toBe(count)
        for (const c of p) {
          expect(isHex(c.hex)).toBe(true)
          for (const v of c.rgb) expect(Number.isFinite(v)).toBe(true)
        }
      }
    }
  })

  it('guarantees a usable lightness spread (a light + a dark always exist)', () => {
    // sweep many seeds/styles: the harmonizer must always deliver a background-able contrast range
    for (const style of PALETTE_STYLES) {
      for (let seed = 0; seed < 30; seed++) {
        const cs = generatePaletteOklch(seed * 7 + 1, 5, style)
        const Ls = cs.map((c) => c.L)
        const spread = Math.max(...Ls) - Math.min(...Ls)
        expect(spread).toBeGreaterThanOrEqual(0.4) // ~MIN_LIGHTNESS_SPREAD, minus float slack
      }
    }
  })

  it('does not emit perceptually duplicate colors (pairwise ΔE clears the dedupe floor)', () => {
    for (const style of CONCRETE_STYLES) {
      for (let seed = 0; seed < 12; seed++) {
        const cs = generatePaletteOklch(seed * 13 + 2024, 6, style)
        for (let i = 0; i < cs.length; i++)
          for (let j = 0; j < i; j++) expect(deltaE(cs[i], cs[j])).toBeGreaterThan(0.045)
      }
    }
  })

  it('auto picks a real recipe and yields a coherent palette', () => {
    const p = generatePaletteColors(314, 6, 'auto')
    expect(p.length).toBe(6)
    expect(isHex(p[0].hex)).toBe(true)
  })

  it('resolveStyle names the concrete recipe auto used, and picking it reproduces the palette', () => {
    for (let seed = 0; seed < 20; seed++) {
      const r = resolveStyle(seed, 'auto')
      expect(CONCRETE_STYLES).toContain(r)
      expect(generatePaletteColors(seed, 6, 'auto')).toEqual(generatePaletteColors(seed, 6, r))
    }
    expect(resolveStyle(5, 'neon')).toBe('neon') // explicit styles resolve to themselves
  })

  it('handles count of 1 without throwing', () => {
    const p = generatePaletteColors(5, 1, 'mono')
    expect(p.length).toBe(1)
    expect(isHex(p[0].hex)).toBe(true)
  })
})
