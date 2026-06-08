import { describe, it, expect } from 'vitest'
import { dyadicLayout } from './dyadic-layout'

describe('dyadicLayout', () => {
  const colors = [
    { rgb: [200, 0, 0] as [number, number, number], weight: 64 },
    { rgb: [0, 200, 0] as [number, number, number], weight: 16 },
    { rgb: [0, 0, 200] as [number, number, number], weight: 4 },
  ]
  it('tiles the unit square with square cells, dominant at top-left', () => {
    const sw = dyadicLayout(colors)
    const area = sw.reduce((s, c) => s + c.w * c.h, 0)
    expect(area).toBeCloseTo(1, 5)
    expect(sw.every((c) => Math.abs(c.w - c.h) < 1e-9)).toBe(true)
    const first = sw.find((c) => c.x === 0 && c.y === 0)!
    expect(first.rgb).toEqual([200, 0, 0])
  })
  it('is deterministic', () => {
    expect(dyadicLayout(colors)).toEqual(dyadicLayout(colors))
  })
  it('tiles the unit square for arbitrary (non power-of-4) weights', () => {
    const odd = [
      { rgb: [10, 10, 10] as [number, number, number], weight: 37 },
      { rgb: [20, 20, 20] as [number, number, number], weight: 11 },
      { rgb: [30, 30, 30] as [number, number, number], weight: 5 },
      { rgb: [40, 40, 40] as [number, number, number], weight: 2 },
    ]
    const sw = dyadicLayout(odd)
    const area = sw.reduce((s, c) => s + c.w * c.h, 0)
    expect(area).toBeCloseTo(1, 5)
    expect(sw.every((c) => Math.abs(c.w - c.h) < 1e-9)).toBe(true)
    // no overlap: pairwise interiors disjoint
    for (let i = 0; i < sw.length; i++)
      for (let j = i + 1; j < sw.length; j++) {
        const a = sw[i]
        const b = sw[j]
        const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
        const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
        expect(ox * oy).toBeLessThan(1e-9)
      }
  })
  it('returns an empty layout for no colors', () => {
    expect(dyadicLayout([])).toEqual([])
  })
})
