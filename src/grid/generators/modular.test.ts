import { describe, it, expect } from 'vitest'
import { generateModular, defaultModularParams, randomModularParams } from './modular'
import { checkBounds } from '../invariants'
import { mulberry32 } from '../prng'

describe('generateModular', () => {
  it('produces columns*rows modules', () => {
    const g = generateModular(5, { ...defaultModularParams, columns: 4, rows: 3 })
    expect(g.modules.length).toBe(12)
  })

  it('keeps every module inside the unit square (margins respected)', () => {
    for (const seed of [1, 9, 77, 5000]) {
      const g = generateModular(seed, randomModularParams(mulberry32(seed)))
      expect(checkBounds(g.modules)).toBe(true)
    }
  })

  it('aligns columns: modules in the same column share x and w', () => {
    const g = generateModular(1, { ...defaultModularParams, columns: 3, rows: 2 })
    const col0 = g.modules.filter((_, i) => i % 3 === 0)
    expect(col0[0].x).toBeCloseTo(col0[1].x, 10)
    expect(col0[0].w).toBeCloseTo(col0[1].w, 10)
  })

  it('is deterministic', () => {
    expect(generateModular(3, defaultModularParams).modules).toEqual(
      generateModular(3, defaultModularParams).modules,
    )
  })
})
