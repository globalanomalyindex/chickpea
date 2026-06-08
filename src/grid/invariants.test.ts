import { describe, it, expect } from 'vitest'
import { checkBounds, checkTiling } from './invariants'
import type { Module } from './types'

const EPS = 1e-9

describe('checkBounds', () => {
  it('accepts modules inside the unit square', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }]
    expect(checkBounds(mods, EPS)).toBe(true)
  })
  it('rejects a module that overflows', () => {
    const mods: Module[] = [{ x: 0.8, y: 0, w: 0.5, h: 1 }]
    expect(checkBounds(mods, EPS)).toBe(false)
  })
})

describe('checkTiling', () => {
  it('confirms a perfect 2-cell split covers and is disjoint', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.382, h: 1 }, { x: 0.382, y: 0, w: 0.618, h: 1 }]
    const r = checkTiling(mods, 1e-6)
    expect(r.covered).toBe(true)
    expect(r.disjoint).toBe(true)
  })
  it('detects a gap', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.3, h: 1 }, { x: 0.4, y: 0, w: 0.6, h: 1 }]
    expect(checkTiling(mods, 1e-6).covered).toBe(false)
  })
  it('detects an overlap', () => {
    const mods: Module[] = [{ x: 0, y: 0, w: 0.6, h: 1 }, { x: 0.4, y: 0, w: 0.6, h: 1 }]
    expect(checkTiling(mods, 1e-6).disjoint).toBe(false)
  })
})
