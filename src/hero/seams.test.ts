import { describe, it, expect } from 'vitest'
import { buildSeams, nearestSeam, separationOffset, type Box } from './seams'

// three letters in a row, each 100 wide, 200 tall, with 20px gaps
const letters: Box[] = [
  { id: 'C', x: 0, y: 0, w: 100, h: 200 },
  { id: 'h', x: 120, y: 0, w: 100, h: 200 },
  { id: 'i', x: 240, y: 0, w: 100, h: 200 },
]

describe('buildSeams (horizontal neighbors -> vertical seams)', () => {
  it('creates one seam per adjacent pair', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    expect(seams.length).toBe(2)
    expect(seams[0].axis).toBe('v') // a vertical seam between side-by-side letters
    expect(seams[0].gap).toBeCloseTo(20, 6)
    expect(seams[0].center.x).toBeCloseTo(110, 6) // midpoint of the gap
    expect(seams[0].leftIds).toEqual(['C'])
    expect(seams[0].rightIds).toEqual(['h', 'i'])
  })
})

describe('buildSeams (stacked boxes -> horizontal seams)', () => {
  it('measures vertical gaps for axis y', () => {
    const lines: Box[] = [
      { id: 'l0', x: 0, y: 0, w: 300, h: 50 },
      { id: 'l1', x: 0, y: 70, w: 300, h: 50 },
    ]
    const seams = buildSeams([{ group: 'block', boxes: lines, axis: 'y' }])
    expect(seams.length).toBe(1)
    expect(seams[0].axis).toBe('h')
    expect(seams[0].gap).toBeCloseTo(20, 6)
    expect(seams[0].center.y).toBeCloseTo(60, 6)
  })
})

describe('nearestSeam', () => {
  it('returns the seam whose center is closest, within the radius', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    const hit = nearestSeam(seams, { x: 232, y: 100 }, 120)
    expect(hit?.center.x).toBeCloseTo(230, 6) // the second seam (between h and i)
  })

  it('returns null when nothing is within the radius', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    expect(nearestSeam(seams, { x: 1000, y: 1000 }, 120)).toBeNull()
  })
})

describe('separationOffset', () => {
  it('pushes left-side boxes negative and right-side positive, with falloff', () => {
    const seams = buildSeams([{ group: 'title', boxes: letters, axis: 'x' }])
    const seam = seams[0] // between C(index0) and h
    const ids = ['C', 'h', 'i']
    expect(separationOffset(seam, 'C', ids, 24)).toBeCloseTo(-12, 6) // full, immediate left
    expect(separationOffset(seam, 'h', ids, 24)).toBeCloseTo(12, 6) // full, immediate right
    expect(separationOffset(seam, 'i', ids, 24)).toBeCloseTo(12 * 0.6, 6) // one further, falloff
  })
})
