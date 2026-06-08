import { describe, it, expect } from 'vitest'
import { generateRecursive, defaultRecursiveParams } from './recursive'
import { checkBounds, checkTiling } from '../invariants'

describe('generateRecursive', () => {
  it('produces exactly targetModules cells', () => {
    const g = generateRecursive(123, { ...defaultRecursiveParams, targetModules: 9 })
    expect(g.modules.length).toBe(9)
  })

  it('tiles the unit square with no gaps or overlaps', () => {
    for (const seed of [1, 2, 42, 999, 100000]) {
      const g = generateRecursive(seed, defaultRecursiveParams)
      expect(checkBounds(g.modules)).toBe(true)
      const t = checkTiling(g.modules)
      expect(t.covered).toBe(true)
      expect(t.disjoint).toBe(true)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = generateRecursive(7, defaultRecursiveParams)
    const b = generateRecursive(7, defaultRecursiveParams)
    expect(a.modules).toEqual(b.modules)
    expect(a.guides).toEqual(b.guides)
  })

  it('different seeds give different layouts', () => {
    const a = generateRecursive(1, defaultRecursiveParams)
    const b = generateRecursive(2, defaultRecursiveParams)
    expect(a.modules).not.toEqual(b.modules)
  })
})
