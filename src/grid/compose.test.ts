import { describe, it, expect } from 'vitest'
import { composeGrid, type CompBox } from './compose'
import { checkBounds, checkTiling } from './invariants'

const W = 758
const H = 540

/** A few representative compositions (px) the hero might be in after the user moves things. */
const arrangements: CompBox[][] = [
  // resting-ish: a couple of right-aligned blocks + a left block
  [
    { x: 430, y: 540, w: 305, h: 120 },
    { x: 250, y: 686, w: 485, h: 218 },
    { x: 38, y: 864, w: 360, h: 120 },
  ],
  // dragged into a tighter cluster
  [
    { x: 120, y: 200, w: 200, h: 90 },
    { x: 360, y: 220, w: 240, h: 90 },
    { x: 300, y: 420, w: 180, h: 80 },
  ],
  // edges hugging the borders (should be filtered out, never produce a guide on the frame)
  [
    { x: 0, y: 0, w: 60, h: 40 },
    { x: 700, y: 0, w: 58, h: 40 },
  ],
  // empty composition (degenerate but still valid)
  [],
]

describe('composeGrid', () => {
  it('ALWAYS produces a valid zero-gap, in-bounds tiling — no matter the arrangement or seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const comp of arrangements) {
        const grid = composeGrid(seed, comp, W, H)
        expect(checkBounds(grid.modules)).toBe(true)
        const tiling = checkTiling(grid.modules)
        expect(tiling.covered).toBe(true) // covers the unit square with zero overlap
        expect(tiling.disjoint).toBe(true)
      }
    }
  })

  it('anchors vertical guides to the composition column edges (responds to where words are)', () => {
    const comp: CompBox[] = [{ x: 200, y: 100, w: 300, h: 80 }] // edges at 200 and 500 px
    const grid = composeGrid(7, comp, W, H)
    const vs = grid.guides.filter((g) => g.axis === 'v').map((g) => g.pos)
    expect(vs).toContainEqual(200 / W)
    expect(vs).toContainEqual(500 / W)
  })

  it('moving the composition moves the vertical guides (the grid re-derives to fit)', () => {
    const before = composeGrid(7, [{ x: 200, y: 100, w: 300, h: 80 }], W, H)
    const after = composeGrid(7, [{ x: 260, y: 100, w: 300, h: 80 }], W, H)
    const vsBefore = before.guides.filter((g) => g.axis === 'v').map((g) => g.pos)
    const vsAfter = after.guides.filter((g) => g.axis === 'v').map((g) => g.pos)
    expect(vsBefore).not.toEqual(vsAfter)
    expect(vsAfter).toContainEqual(260 / W)
  })

  it('never places a guide on the frame (edges hugging 0/1 are filtered out)', () => {
    const grid = composeGrid(3, arrangements[2], W, H)
    for (const g of grid.guides) {
      if (g.axis === 'v') {
        expect(g.pos).toBeGreaterThan(0.0)
        expect(g.pos).toBeLessThan(1.0)
      }
    }
  })

  it('is deterministic (same seed + composition -> identical grid)', () => {
    const a = composeGrid(11, arrangements[0], W, H)
    const b = composeGrid(11, arrangements[0], W, H)
    expect(a.guides).toEqual(b.guides)
    expect(a.modules).toEqual(b.modules)
  })

  it('keeps varying across seeds (rows re-randomize even for a fixed composition)', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      const grid = composeGrid(seed, arrangements[0], W, H)
      const rows = grid.guides
        .filter((g) => g.axis === 'h')
        .map((g) => g.pos.toFixed(3))
        .join(',')
      seen.add(rows)
    }
    expect(seen.size).toBeGreaterThan(1) // it keeps randomizing
  })

  it('handles the empty composition as a valid (column-less) grid', () => {
    const grid = composeGrid(5, [], W, H)
    expect(grid.guides.filter((g) => g.axis === 'v').length).toBe(0)
    expect(checkTiling(grid.modules).covered).toBe(true)
  })
})
