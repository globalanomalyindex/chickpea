import { describe, it, expect } from 'vitest'
import { snapToRatio, buildAnchoredGrid, snapCut, RATIO_POSITIONS, type Cut } from './anchor'
import { checkBounds, checkTiling } from './invariants'

describe('snapToRatio', () => {
  it('snaps a rough cut to the nearest ratio-correct position', () => {
    expect(snapToRatio(0.51)).toBeCloseTo(0.5, 6)
    expect(snapToRatio(0.61)).toBeCloseTo(0.618, 6) // golden section nearest
    expect(snapToRatio(0.59)).toBeCloseTo(2 - Math.SQRT2, 6) // silver complement nearest
    expect(snapToRatio(0.42)).toBeCloseTo(Math.SQRT2 - 1, 6) // silver section nearest
    expect(RATIO_POSITIONS).toContain(0.5)
  })
})

describe('buildAnchoredGrid', () => {
  const cuts: Cut[] = [
    { axis: 'v', pos: 0.52 },
    { axis: 'h', pos: 0.4 }, // nearest canon is now the silver section √2−1 ≈ 0.414
  ]
  const SILVER = Math.SQRT2 - 1
  it('honors snapped cuts and tiles the unit square', () => {
    const g = buildAnchoredGrid(cuts, 1)
    // a vertical guide near 0.5 and a horizontal at the silver section exist
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
      expect(g.guides.some((gd) => gd.axis === 'h' && Math.abs(gd.pos - SILVER) < 1e-6)).toBe(true)
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

describe('nested snapping (anchors compose)', () => {
  it('a second cut can snap to a canon ratio OF the segment between anchors', () => {
    // first cut owns 0.5; the second at 0.81 reads as the golden point of the right half
    // (0.5 + 0.5·0.618 = 0.809) rather than the farther global ⅘
    const g = buildAnchoredGrid(
      [
        { axis: 'v', pos: 0.5 },
        { axis: 'v', pos: 0.81 },
      ],
      1,
    )
    expect(g.guides.some((gd) => gd.axis === 'v' && Math.abs(gd.pos - 0.809) < 1e-3)).toBe(true)
    // and the readout names the segment ratio the human actually took
    expect(g.ratios.some((r) => Math.abs(r.value - 0.618) < 1e-6)).toBe(true)
  })

  it('a clearly-global second cut still snaps globally', () => {
    const g = buildAnchoredGrid(
      [
        { axis: 'v', pos: 0.5 },
        { axis: 'v', pos: 0.755 },
      ],
      1,
    )
    expect(g.guides.some((gd) => gd.axis === 'v' && Math.abs(gd.pos - 0.75) < 1e-6)).toBe(true)
  })

  it('anchored interiors are grown on the slice-tree with truthful cut metadata', () => {
    const g = buildAnchoredGrid([{ axis: 'v', pos: 0.5 }], 9)
    const cuts = g.meta?.cuts as { frac: number }[] | undefined
    expect(cuts && cuts.length).toBeTruthy()
  })
})

describe('snapCut (the UI-facing snapper)', () => {
  it('snaps globally and names the position truthfully', () => {
    const s = snapCut(0.51, [])
    expect(s?.pos).toBeCloseTo(0.5, 9)
    expect(s?.name).toBe('½')
    expect(s?.nested).toBe(false)
  })
  it('snaps to the golden point of a segment when that reads truer', () => {
    const s = snapCut(0.81, [0.5])
    expect(s?.pos).toBeCloseTo(0.809, 3)
    expect(s?.name).toBe('1/φ')
    expect(s?.nested).toBe(true)
  })
  it('declines (null) instead of crowding an existing cut', () => {
    expect(snapCut(0.5, [0.5])).toBeNull()
  })
})
