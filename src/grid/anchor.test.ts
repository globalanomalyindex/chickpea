import { describe, it, expect } from 'vitest'
import { snapToRatio, buildAnchoredGrid, RATIO_POSITIONS, type Cut } from './anchor'
import { checkBounds, checkTiling } from './invariants'

describe('snapToRatio', () => {
  it('snaps a rough cut to the nearest ratio-correct position', () => {
    expect(snapToRatio(0.51)).toBeCloseTo(0.5, 6)
    expect(snapToRatio(0.6)).toBeCloseTo(0.618, 6) // golden section nearest
    expect(RATIO_POSITIONS).toContain(0.5)
  })
})

describe('buildAnchoredGrid', () => {
  const cuts: Cut[] = [
    { axis: 'v', pos: 0.52 },
    { axis: 'h', pos: 0.4 },
  ]
  it('honors snapped cuts and tiles the unit square', () => {
    const g = buildAnchoredGrid(cuts, 1)
    // a vertical guide near 0.5 and a horizontal near 0.382 exist
    expect(g.guides.some((gd) => gd.axis === 'v' && Math.abs(gd.pos - 0.5) < 1e-6)).toBe(true)
    expect(checkBounds(g.modules)).toBe(true)
    expect(checkTiling(g.modules).covered).toBe(true)
  })
  it('different seeds vary the in-region subdivisions but keep the anchors', () => {
    const a = buildAnchoredGrid(cuts, 1)
    const b = buildAnchoredGrid(cuts, 2)
    expect(a.modules).not.toEqual(b.modules)
    // both keep the snapped vertical anchor at 0.5
    for (const g of [a, b]) expect(g.guides.some((gd) => gd.axis === 'v' && Math.abs(gd.pos - 0.5) < 1e-6)).toBe(true)
  })
  it('keeps invariants and the snapped anchors for many seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = buildAnchoredGrid(cuts, seed)
      expect(checkBounds(g.modules)).toBe(true)
      const t = checkTiling(g.modules)
      expect(t.covered).toBe(true)
      expect(t.disjoint).toBe(true)
      // snapped anchors survive every seed
      expect(g.guides.some((gd) => gd.axis === 'v' && Math.abs(gd.pos - 0.5) < 1e-6)).toBe(true)
      expect(g.guides.some((gd) => gd.axis === 'h' && Math.abs(gd.pos - 0.382) < 1e-6)).toBe(true)
    }
  })
  it('is deterministic for a given seed', () => {
    expect(buildAnchoredGrid(cuts, 7).modules).toEqual(buildAnchoredGrid(cuts, 7).modules)
    expect(buildAnchoredGrid(cuts, 7).guides).toEqual(buildAnchoredGrid(cuts, 7).guides)
  })
  it('produces a valid tiling even with no cuts', () => {
    const g = buildAnchoredGrid([], 3)
    expect(checkBounds(g.modules)).toBe(true)
    expect(checkTiling(g.modules).covered).toBe(true)
    expect(g.meta.anchored).toBe(true)
  })
  it('marks the grid recursive + anchored with snapped ratios', () => {
    const g = buildAnchoredGrid(cuts, 1)
    expect(g.generator).toBe('recursive')
    expect(g.meta.anchored).toBe(true)
    expect(g.ratios.some((r) => Math.abs(r.value - 0.5) < 1e-6)).toBe(true)
  })
})
