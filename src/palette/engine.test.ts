import { describe, it, expect } from 'vitest'
import { generatePaletteColors, generatePaletteOklch } from './engine'
import { scorePalette } from './score'
import { deltaE } from './oklch'

const isHex = (s: string) => /^#[0-9a-f]{6}$/.test(s)

describe('palette engine (procedural selection)', () => {
  it('returns exactly `count` valid hex colors with descending weights, hero first', () => {
    for (const count of [2, 3, 5, 8, 12]) {
      const p = generatePaletteColors(99, count)
      expect(p.length).toBe(count)
      for (const c of p) expect(isHex(c.hex)).toBe(true)
      for (let i = 1; i < p.length; i++) expect(p[i].weight).toBeLessThanOrEqual(p[i - 1].weight)
    }
  })

  it('is deterministic for (seed, count)', () => {
    expect(generatePaletteColors(7, 6)).toEqual(generatePaletteColors(7, 6))
  })

  it('different seeds diverge', () => {
    expect(generatePaletteColors(1, 6)[0].hex).not.toBe(generatePaletteColors(2, 6)[0].hex)
  })

  it('every output is in-gamut and finite at every count', () => {
    for (const count of [2, 4, 7, 10, 12]) {
      const p = generatePaletteColors(count * 31 + 5, count)
      for (const c of p) {
        expect(isHex(c.hex)).toBe(true)
        for (const v of c.rgb) expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('guarantees a usable lightness spread (enforceSpread floor; deliberate high-/low-key allowed)', () => {
    for (let seed = 0; seed < 40; seed++) {
      const cs = generatePaletteOklch(seed * 7 + 1, 5)
      const Ls = cs.map((c) => c.L)
      // MIN_LIGHTNESS_SPREAD is 0.28 — deliberately low so pastels/moody keys survive — minus slack
      expect(Math.max(...Ls) - Math.min(...Ls)).toBeGreaterThanOrEqual(0.27)
    }
  })

  it('never emits perceptually duplicate colors', () => {
    for (let seed = 0; seed < 40; seed++) {
      const cs = generatePaletteOklch(seed * 13 + 2, 6)
      for (let i = 0; i < cs.length; i++)
        for (let j = 0; j < i; j++) expect(deltaE(cs[i], cs[j])).toBeGreaterThan(0.045)
    }
  })

  it('the selector emits quality: every output clears a score floor across many seeds', () => {
    let min = Infinity
    for (let seed = 0; seed < 80; seed++) {
      const s = scorePalette(generatePaletteOklch(seed * 5 + 3, 6)).total
      min = Math.min(min, s)
    }
    // the coherence-gated scorer is strict (a low score = a quieter palette, not a dud — verified
    // visually), so the floor is lower than the raw weighted sum; even the worst output is usable.
    expect(min).toBeGreaterThan(0.33)
  })

  it('handles count of 1 without throwing', () => {
    const p = generatePaletteColors(5, 1)
    expect(p.length).toBe(1)
    expect(isHex(p[0].hex)).toBe(true)
  })
})
