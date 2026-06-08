import { describe, it, expect } from 'vitest'
import { generateNature, defaultNatureParams } from './nature'
import { checkBounds, checkTiling } from '../invariants'

const PHI = 1.6180339887

describe('generateNature', () => {
  it('tiles the unit square via golden subdivision', () => {
    for (const seed of [1, 2, 42, 8080]) {
      const g = generateNature(seed, defaultNatureParams)
      expect(checkBounds(g.modules)).toBe(true)
      const t = checkTiling(g.modules)
      expect(t.covered).toBe(true)
      expect(t.disjoint).toBe(true)
    }
  })

  it('cuts at the golden section (a child width ratio ≈ 1:φ on the first split)', () => {
    const g = generateNature(1, { ...defaultNatureParams, depth: 1 })
    expect(g.modules.length).toBe(2)
    const widths = g.modules.map((m) => m.w * m.h) // areas, since one axis is full
    const ratio = Math.max(...widths) / Math.min(...widths)
    expect(ratio).toBeCloseTo(PHI, 2)
  })

  it('produces depth+1 modules and is deterministic', () => {
    const g = generateNature(3, { ...defaultNatureParams, depth: 6 })
    expect(g.modules.length).toBe(7)
    expect(generateNature(3, { ...defaultNatureParams, depth: 6 }).modules).toEqual(g.modules)
  })
})
