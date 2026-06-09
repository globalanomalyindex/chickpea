import { describe, it, expect } from 'vitest'
import { generateGrid, quantizeDials, DEFAULT_DIALS } from './engine'
import { scoreGrid } from './score'
import { checkBounds, checkTiling, checkCrispGuides } from './invariants'
import type { Dials } from './genome'

const CORNERS: Dials[] = []
for (const complexity of [0, 0.5, 1]) {
  for (const tension of [0, 0.5, 1]) {
    for (const rhythm of [0, 0.5, 1]) CORNERS.push({ complexity, tension, rhythm })
  }
}

describe('grid engine (procedural selection)', () => {
  it('every emitted grid is a perfect tiling with crisp guides, across seeds × dial corners', () => {
    for (const dials of CORNERS) {
      for (let seed = 0; seed < 25; seed++) {
        const grid = generateGrid(seed * 7 + 1, dials)
        expect(checkBounds(grid.modules, 1e-9)).toBe(true)
        expect(checkTiling(grid.modules, 1e-9).covered).toBe(true)
        expect(checkCrispGuides(grid)).toBe(true)
        expect(grid.modules.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('is deterministic for (seed, dials)', () => {
    expect(generateGrid(7, DEFAULT_DIALS)).toEqual(generateGrid(7, DEFAULT_DIALS))
    const d: Dials = { complexity: 0.8, tension: 0.2, rhythm: 0.9 }
    expect(generateGrid(7, d)).toEqual(generateGrid(7, d))
  })

  it('different seeds diverge', () => {
    expect(generateGrid(1).modules.length + generateGrid(1).guides.length).toBeTypeOf('number')
    expect(generateGrid(1)).not.toEqual(generateGrid(2))
  })

  it('dials quantize so sub-quantum differences reproduce identically', () => {
    expect(quantizeDials({ complexity: 0.52, tension: 0.48, rhythm: 0.01 })).toEqual({
      complexity: 0.5,
      tension: 0.5,
      rhythm: 0,
    })
    // two dial values in the same quantum bucket (→ 0.50) yield the same grid
    expect(generateGrid(3, { complexity: 0.48, tension: 0.5, rhythm: 0.5 })).toEqual(
      generateGrid(3, { complexity: 0.52, tension: 0.5, rhythm: 0.5 }),
    )
  })

  it('the selector emits quality: every output clears a score floor across many seeds', () => {
    let min = Infinity
    for (let seed = 0; seed < 120; seed++) {
      const dials = CORNERS[seed % CORNERS.length]
      const s = scoreGrid(generateGrid(seed * 5 + 3, dials), dials).total
      min = Math.min(min, s)
    }
    // population (30) + hill-climb (20) reliably finds a strong champion for every dial setting
    expect(min).toBeGreaterThan(0.55)
  })

  it('Complexity dial moves the mean module count (selection respects intent)', () => {
    const meanCount = (cx: number): number => {
      let total = 0
      for (let seed = 0; seed < 30; seed++) total += generateGrid(seed * 3 + 1, { complexity: cx, tension: 0.5, rhythm: 0.5 }).modules.length
      return total / 30
    }
    expect(meanCount(0.9)).toBeGreaterThan(meanCount(0.1) + 2)
  })
})
