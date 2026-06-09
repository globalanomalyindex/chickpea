import { describe, it, expect } from 'vitest'
import { generatePalette } from './generate'

describe('generatePalette (public surface)', () => {
  it('returns exactly count colors as hex with descending weights', () => {
    const p = generatePalette(42, 5)
    expect(p.length).toBe(5)
    expect(p[0].hex).toMatch(/^#[0-9a-f]{6}$/)
    for (let i = 1; i < p.length; i++) expect(p[i].weight).toBeLessThanOrEqual(p[i - 1].weight)
  })

  it('is deterministic for a seed', () => {
    expect(generatePalette(7, 6)).toEqual(generatePalette(7, 6))
  })

  it('different seeds diverge', () => {
    expect(generatePalette(1, 5)[0].hex).not.toBe(generatePalette(2, 5)[0].hex)
  })

  it('carries a truthful HSL readout for every color', () => {
    for (const c of generatePalette(123, 8)) {
      expect(c.h).toBeGreaterThanOrEqual(0)
      expect(c.h).toBeLessThan(360)
      expect(c.s).toBeGreaterThanOrEqual(0)
      expect(c.s).toBeLessThanOrEqual(1)
      expect(c.l).toBeGreaterThanOrEqual(0)
      expect(c.l).toBeLessThanOrEqual(1)
    }
  })
})
