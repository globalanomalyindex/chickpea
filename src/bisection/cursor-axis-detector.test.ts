import { describe, it, expect } from 'vitest'
import { entryEdge, axisForEdge } from './cursor-axis-detector'

const rect = { w: 100, h: 100 }

describe('entryEdge', () => {
  it('detects the edge crossed when moving inside', () => {
    expect(entryEdge({ x: 50, y: -5 }, { x: 50, y: 5 }, rect)).toBe('top')
    expect(entryEdge({ x: 50, y: 105 }, { x: 50, y: 95 }, rect)).toBe('bottom')
    expect(entryEdge({ x: -5, y: 50 }, { x: 5, y: 50 }, rect)).toBe('left')
    expect(entryEdge({ x: 105, y: 50 }, { x: 95, y: 50 }, rect)).toBe('right')
  })
  it('returns null when both points are inside (no crossing)', () => {
    expect(entryEdge({ x: 40, y: 40 }, { x: 60, y: 60 }, rect)).toBeNull()
  })
  it('returns null when curr is still outside', () => {
    expect(entryEdge({ x: 50, y: -10 }, { x: 50, y: -2 }, rect)).toBeNull()
  })
  it('breaks a corner tie by the larger crossing displacement', () => {
    // crosses both top and left; vertical displacement larger -> top
    expect(entryEdge({ x: -2, y: -10 }, { x: 5, y: 5 }, rect)).toBe('top')
    // crosses both top and left; horizontal displacement larger -> left
    expect(entryEdge({ x: -10, y: -2 }, { x: 5, y: 5 }, rect)).toBe('left')
  })
})

describe('axisForEdge', () => {
  it('top/bottom -> v, left/right -> h', () => {
    expect(axisForEdge('top')).toBe('v')
    expect(axisForEdge('bottom')).toBe('v')
    expect(axisForEdge('left')).toBe('h')
    expect(axisForEdge('right')).toBe('h')
  })
})
