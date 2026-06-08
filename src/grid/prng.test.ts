import { describe, it, expect } from 'vitest'
import { mulberry32, randInt, pick } from './prng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produces values in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)())
  })
})

describe('randInt', () => {
  it('stays within [min,max] inclusive', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 2, 5)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(5)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
})

describe('pick', () => {
  it('returns an element from the array', () => {
    const r = mulberry32(3)
    const arr = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) expect(arr).toContain(pick(r, arr))
  })
})
