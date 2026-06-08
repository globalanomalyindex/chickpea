import { describe, it, expect } from 'vitest'
import { generate, GENERATOR_KINDS } from './index'
import { checkBounds } from '../invariants'

describe('generate registry', () => {
  it('exposes all three families', () => {
    expect(GENERATOR_KINDS).toEqual(['recursive', 'modular', 'nature'])
  })

  it('generates a valid grid for each kind from a seed alone', () => {
    for (const kind of GENERATOR_KINDS) {
      const g = generate(kind, 1234)
      expect(g.generator).toBe(kind)
      expect(checkBounds(g.modules)).toBe(true)
      expect(g.modules.length).toBeGreaterThan(1)
    }
  })

  it('is deterministic per (kind, seed)', () => {
    expect(generate('nature', 5).modules).toEqual(generate('nature', 5).modules)
  })
})
