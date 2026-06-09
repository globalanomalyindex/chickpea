import { describe, it, expect } from 'vitest'
import {
  resolveLabelCollisions,
  crossesAny,
  preventOverlap,
  relax,
  layoutLabels,
  type Rect,
  type SolverBox,
} from './collision'

/** Do two axis-aligned rects overlap (strictly, positive-area intersection)? */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

describe('resolveLabelCollisions', () => {
  it('leaves non-overlapping labels untouched (all dy 0)', () => {
    const labels: Rect[] = [
      { x: 0, y: 0, w: 30, h: 12 },
      { x: 0, y: 40, w: 30, h: 12 },
      { x: 0, y: 80, w: 30, h: 12 },
    ]
    const dys = resolveLabelCollisions(labels)
    expect(dys).toEqual([0, 0, 0])
  })

  it('pushes two overlapping labels apart so their nudged rects no longer overlap', () => {
    const labels: Rect[] = [
      { x: 0, y: 100, w: 40, h: 12 },
      { x: 0, y: 104, w: 40, h: 12 }, // overlaps the first by 8px vertically
    ]
    const dys = resolveLabelCollisions(labels)
    expect(dys.length).toBe(2)

    const moved: Rect[] = labels.map((l, i) => ({ ...l, y: l.y + dys[i] }))
    expect(rectsOverlap(moved[0], moved[1])).toBe(false)
  })

  it('only displaces vertically — never moves a label horizontally (it returns dy only)', () => {
    const labels: Rect[] = [
      { x: 10, y: 0, w: 40, h: 12 },
      { x: 10, y: 5, w: 40, h: 12 },
    ]
    const dys = resolveLabelCollisions(labels)
    // returns one dy per label, nothing about x
    expect(dys.length).toBe(labels.length)
    // x is untouched (the function returns dy only); reconstruct + assert no overlap
    const moved: Rect[] = labels.map((l, i) => ({ ...l, y: l.y + dys[i] }))
    expect(rectsOverlap(moved[0], moved[1])).toBe(false)
  })

  it('uses minimal perpendicular displacement (small overlap -> small push)', () => {
    const tight: Rect[] = [
      { x: 0, y: 0, w: 40, h: 12 },
      { x: 0, y: 10, w: 40, h: 12 }, // 2px overlap
    ]
    const wide: Rect[] = [
      { x: 0, y: 0, w: 40, h: 12 },
      { x: 0, y: 2, w: 40, h: 12 }, // 10px overlap
    ]
    const tightPush = resolveLabelCollisions(tight)
    const widePush = resolveLabelCollisions(wide)
    const tightTotal = Math.abs(tightPush[0]) + Math.abs(tightPush[1])
    const wideTotal = Math.abs(widePush[0]) + Math.abs(widePush[1])
    expect(tightTotal).toBeLessThan(wideTotal)
  })

  it('resolves a stack of three overlapping labels so none overlap', () => {
    const labels: Rect[] = [
      { x: 0, y: 0, w: 40, h: 20 },
      { x: 0, y: 10, w: 40, h: 20 },
      { x: 0, y: 20, w: 40, h: 20 },
    ]
    const dys = resolveLabelCollisions(labels)
    const moved: Rect[] = labels.map((l, i) => ({ ...l, y: l.y + dys[i] }))
    for (let i = 0; i < moved.length; i++) {
      for (let j = i + 1; j < moved.length; j++) {
        expect(rectsOverlap(moved[i], moved[j])).toBe(false)
      }
    }
  })

  it('does not displace labels that are separated on x even if their y-extents overlap', () => {
    const labels: Rect[] = [
      { x: 0, y: 0, w: 40, h: 12 },
      { x: 200, y: 4, w: 40, h: 12 }, // same y-band but far away on x -> no real overlap
    ]
    const dys = resolveLabelCollisions(labels)
    expect(dys).toEqual([0, 0])
  })

  it('returns one entry per label, in input order', () => {
    const labels: Rect[] = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 0, y: 5, w: 10, h: 10 },
      { x: 0, y: 9, w: 10, h: 10 },
    ]
    expect(resolveLabelCollisions(labels).length).toBe(labels.length)
  })

  it('handles the empty list', () => {
    expect(resolveLabelCollisions([])).toEqual([])
  })

  it('is deterministic (same input -> same output)', () => {
    const labels: Rect[] = [
      { x: 0, y: 0, w: 40, h: 12 },
      { x: 0, y: 6, w: 40, h: 12 },
      { x: 0, y: 10, w: 40, h: 12 },
    ]
    const a = resolveLabelCollisions(labels)
    const b = resolveLabelCollisions(labels)
    expect(a).toEqual(b)
  })
})

/** Reconstruct moved rects from a relax() result, in input order. */
function moveBoxes(boxes: SolverBox[], res: Map<string, { x: number; y: number }>): Rect[] {
  return boxes.map((b) => {
    const p = res.get(b.id)!
    return { x: p.x, y: p.y, w: b.w, h: b.h }
  })
}

/** Are ALL pairs in a set mutually non-overlapping? */
function allDisjoint(rects: Rect[]): boolean {
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) if (rectsOverlap(rects[i], rects[j])) return false
  return true
}

describe('relax', () => {
  it('leaves an already-disjoint set untouched', () => {
    const boxes: SolverBox[] = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 200, y: 0, w: 40, h: 40 },
    ]
    const res = relax(boxes)
    expect(res.get('a')).toEqual({ x: 0, y: 0 })
    expect(res.get('b')).toEqual({ x: 200, y: 0 })
  })

  it('never moves a pinned box, and pushes the other out of it', () => {
    const boxes: SolverBox[] = [
      { id: 'pin', x: 50, y: 50, w: 40, h: 40, pinned: true },
      { id: 'mob', x: 70, y: 50, w: 40, h: 40 },
    ]
    const res = relax(boxes)
    expect(res.get('pin')).toEqual({ x: 50, y: 50 }) // pinned unchanged
    expect(allDisjoint(moveBoxes(boxes, res))).toBe(true)
  })

  it('PROPAGATES a push down a chain: a pinned box clears a whole row of neighbors', () => {
    // a pinned box overlapping a tight row A-B-C-D; the push must cascade so NONE overlap
    const boxes: SolverBox[] = [
      { id: 'drag', x: 45, y: 0, w: 40, h: 40, pinned: true },
      { id: 'A', x: 50, y: 0, w: 40, h: 40 },
      { id: 'B', x: 90, y: 0, w: 40, h: 40 },
      { id: 'C', x: 130, y: 0, w: 40, h: 40 },
      { id: 'D', x: 170, y: 0, w: 40, h: 40 },
    ]
    const res = relax(boxes)
    expect(res.get('drag')).toEqual({ x: 45, y: 0 })
    expect(allDisjoint(moveBoxes(boxes, res))).toBe(true)
  })

  it('two mobile boxes split the separation symmetrically (cluster stays centered)', () => {
    const boxes: SolverBox[] = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 20, y: 0, w: 40, h: 40 }, // 20px overlap on x
    ]
    const res = relax(boxes)
    const a = res.get('a')!
    const b = res.get('b')!
    expect(a.x).toBeLessThan(0) // a pushed left
    expect(b.x).toBeGreaterThan(20) // b pushed right
    expect(Math.abs(0 - a.x)).toBeCloseTo(Math.abs(b.x - 20), 5) // symmetric
  })

  it('resolves a 2D cluster so every pair is disjoint', () => {
    const boxes: SolverBox[] = [
      { id: 'a', x: 0, y: 0, w: 50, h: 50 },
      { id: 'b', x: 20, y: 20, w: 50, h: 50 },
      { id: 'c', x: 40, y: 10, w: 50, h: 50 },
      { id: 'd', x: 10, y: 40, w: 50, h: 50 },
    ]
    const res = relax(boxes)
    expect(allDisjoint(moveBoxes(boxes, res))).toBe(true)
  })

  it('respects padding (boxes rest apart, not kissing)', () => {
    const boxes: SolverBox[] = [
      { id: 'pin', x: 50, y: 50, w: 40, h: 40, pinned: true },
      { id: 'mob', x: 85, y: 50, w: 40, h: 40 },
    ]
    const res = relax(boxes, { pad: 6 })
    const m = res.get('mob')!
    // mob pushed right; its left edge must clear pin's right edge by ~pad
    expect(m.x - (50 + 40)).toBeGreaterThanOrEqual(5.5)
  })

  it('is deterministic and does not mutate inputs', () => {
    const mk = (): SolverBox[] => [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 20, y: 0, w: 40, h: 40 },
    ]
    const boxes = mk()
    const r1 = relax(boxes)
    const r2 = relax(mk())
    expect([...r1.entries()]).toEqual([...r2.entries()])
    expect(boxes).toEqual(mk()) // unchanged
  })

  it('useHome leaves a pair that overlaps only by its rest amount untouched', () => {
    // title and line graze at rest by 10px on y; home = current, so the overlap is allowed
    const title: SolverBox = { id: 'title', x: 0, y: 0, w: 100, h: 100 }
    const line: SolverBox = { id: 'line', x: 0, y: 90, w: 100, h: 30 }
    const res = relax([title, line], { useHome: true })
    expect(res.get('title')).toEqual({ x: 0, y: 0 })
    expect(res.get('line')).toEqual({ x: 0, y: 90 })
  })

  it('useHome preserves rest grazing but resolves overlap BEYOND it (the dragged-into-a-line case)', () => {
    // line0 (pinned, the obstacle) and line1 graze by 6px at rest; line1 is dragged UP into line0
    // (30px overlap). It must be pushed back down to ~the rest 6px overlap, not fully separated.
    const a: SolverBox = { id: 'a', x: 0, y: 0, w: 100, h: 50, pinned: true, hx: 0, hy: 0 }
    const b: SolverBox = { id: 'b', x: 0, y: 20, w: 100, h: 50, hx: 0, hy: 44 } // home grazes by 6
    const res = relax([a, b], { useHome: true })
    const by = res.get('b')!.y
    expect(by).toBeGreaterThan(40) // pushed back DOWN toward its rest position (44), not to 50+
    expect(by).toBeLessThan(46)
  })

  it('useHome + pad does NOT drift a rest-overlapping pair (the pad-asymmetry regression)', () => {
    // two boxes overlapping at rest (home = current); with breathing-room pad they must NOT move —
    // the old code added pad to current penetration but not rest, leaving a constant pad of excess
    // that the loop turned into unbounded drift.
    const a: SolverBox = { id: 'a', x: 0, y: 0, w: 100, h: 100, hx: 0, hy: 0 }
    const b: SolverBox = { id: 'b', x: 30, y: 30, w: 100, h: 100, hx: 30, hy: 30 }
    const res = relax([a, b], { useHome: true, pad: 6 })
    expect(res.get('a')).toEqual({ x: 0, y: 0 })
    expect(res.get('b')).toEqual({ x: 30, y: 30 })
  })

  it('without useHome, ALL overlap resolves (label-style full clearance)', () => {
    const a: SolverBox = { id: 'a', x: 0, y: 0, w: 100, h: 50, pinned: true }
    const b: SolverBox = { id: 'b', x: 0, y: 20, w: 100, h: 50 } // overlaps a by 30 on y
    const res = relax([a, b]) // no useHome -> full resolution
    const by = res.get('b')!.y
    expect(by).toBeGreaterThanOrEqual(50) // fully cleared below a
  })
})

describe('layoutLabels', () => {
  it('leaves a label that overlaps nothing where it is', () => {
    const labels: SolverBox[] = [{ id: 'L1', x: 0, y: 0, w: 30, h: 12 }]
    const obstacles: Rect[] = [{ x: 200, y: 200, w: 40, h: 40 }]
    expect(layoutLabels(labels, obstacles).get('L1')).toEqual({ dx: 0, dy: 0 })
  })

  it('pushes a label off an obstacle (word) it overlaps', () => {
    const labels: SolverBox[] = [{ id: 'L1', x: 100, y: 100, w: 30, h: 12 }]
    const obstacles: Rect[] = [{ x: 90, y: 95, w: 60, h: 30 }]
    const d = layoutLabels(labels, obstacles).get('L1')!
    const moved: Rect = { x: 100 + d.dx, y: 100 + d.dy, w: 30, h: 12 }
    expect(rectsOverlap(moved, obstacles[0])).toBe(false)
  })

  it('separates two clashing labels AND keeps them off obstacles', () => {
    const labels: SolverBox[] = [
      { id: 'L1', x: 100, y: 100, w: 30, h: 12 },
      { id: 'L2', x: 108, y: 104, w: 30, h: 12 },
    ]
    const obstacles: Rect[] = [{ x: 60, y: 100, w: 30, h: 12 }]
    const ds = layoutLabels(labels, obstacles)
    const moved = labels.map((l) => {
      const d = ds.get(l.id)!
      return { x: l.x + d.dx, y: l.y + d.dy, w: l.w, h: l.h }
    })
    expect(rectsOverlap(moved[0], moved[1])).toBe(false)
    for (const m of moved) expect(rectsOverlap(m, obstacles[0])).toBe(false)
  })

  it('escapes a label boxed into a dense, mutually-overlapping field (the title-letter stall)', () => {
    // mimic the 200px title: a row of big, ~20px-overlapping letter boxes; two numbers seeded
    // right in the middle must BOTH end clear of every letter and of each other.
    const letters: Rect[] = []
    for (let i = 0; i < 8; i++) letters.push({ x: i * 80, y: 0, w: 100, h: 200 })
    const labels: SolverBox[] = [
      { id: 'n1', x: 250, y: 95, w: 18, h: 13 }, // buried in the letters
      { id: 'n2', x: 268, y: 100, w: 18, h: 13 }, // buried + clashing with n1
    ]
    const ds = layoutLabels(labels, letters, 2)
    const moved = labels.map((l) => {
      const d = ds.get(l.id)!
      return { x: l.x + d.dx, y: l.y + d.dy, w: l.w, h: l.h }
    })
    for (const m of moved) for (const L of letters) expect(rectsOverlap(m, L)).toBe(false)
    expect(rectsOverlap(moved[0], moved[1])).toBe(false)
  })
})

describe('crossesAny', () => {
  const words: Rect[] = [
    { x: 100, y: 100, w: 80, h: 30 },
    { x: 300, y: 200, w: 80, h: 30 },
  ]

  it('is true when the rect overlaps a word', () => {
    const a: Rect = { x: 120, y: 110, w: 20, h: 5 } // inside the first word
    expect(crossesAny(a, words)).toBe(true)
  })

  it('is true when an arrow rect straddles a word edge', () => {
    const a: Rect = { x: 90, y: 110, w: 20, h: 4 } // crosses the left edge of the first word
    expect(crossesAny(a, words)).toBe(true)
  })

  it('is false when the rect misses every word', () => {
    const a: Rect = { x: 0, y: 0, w: 20, h: 20 }
    expect(crossesAny(a, words)).toBe(false)
  })

  it('treats edge-only touching (zero-area overlap) as NOT crossing', () => {
    // a sits exactly to the left, its right edge touching the word's left edge at x=100
    const a: Rect = { x: 80, y: 100, w: 20, h: 30 }
    expect(crossesAny(a, words)).toBe(false)
  })

  it('is false against an empty word list', () => {
    expect(crossesAny({ x: 0, y: 0, w: 10, h: 10 }, [])).toBe(false)
  })

  it('detects overlap with the second word when the first is missed', () => {
    const a: Rect = { x: 310, y: 210, w: 10, h: 5 }
    expect(crossesAny(a, words)).toBe(true)
  })
})

describe('preventOverlap', () => {
  it('leaves well-separated boxes alone (offsets unchanged, nothing corrected)', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 200, y: 0, w: 40, h: 40 },
    ]
    const offsets = new Map([
      ['a', { dx: 2, dy: 0 }],
      ['b', { dx: -2, dy: 0 }],
    ])
    const res = preventOverlap(boxes, offsets)
    expect(res.corrected).toEqual([])
    expect(res.offsets.get('a')).toEqual({ dx: 2, dy: 0 })
    expect(res.offsets.get('b')).toEqual({ dx: -2, dy: 0 })
  })

  it('clamps two elements nudged into each other so their boxes no longer overlap, and reports them', () => {
    // two boxes side by side with a 10px gap; nudges drive them 20px toward each other -> overlap
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 50, y: 0, w: 40, h: 40 }, // gap of 10 between a.right(40) and b.left(50)
    ]
    const offsets = new Map([
      ['a', { dx: 20, dy: 0 }], // a moves right into b
      ['b', { dx: -20, dy: 0 }], // b moves left into a
    ])
    const res = preventOverlap(boxes, offsets)

    const moved = boxes.map((box) => {
      const o = res.offsets.get(box.id) ?? { dx: 0, dy: 0 }
      return { ...box, x: box.x + o.dx, y: box.y + o.dy }
    })
    expect(rectsOverlap(moved[0], moved[1])).toBe(false)
    expect(res.corrected).toContain('a')
    expect(res.corrected).toContain('b')
  })

  it('does not introduce overlap when one nudged box would collide with a stationary one', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 50, y: 0, w: 40, h: 40 },
    ]
    const offsets = new Map([
      ['a', { dx: 30, dy: 0 }], // only a moves, straight into b
    ])
    const res = preventOverlap(boxes, offsets)
    const moved = boxes.map((box) => {
      const o = res.offsets.get(box.id) ?? { dx: 0, dy: 0 }
      return { ...box, x: box.x + o.dx, y: box.y + o.dy }
    })
    expect(rectsOverlap(moved[0], moved[1])).toBe(false)
    expect(res.corrected).toContain('a')
  })

  it('preserves nudges that do not cause any overlap', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 200, y: 0, w: 40, h: 40 },
    ]
    const offsets = new Map([['a', { dx: 10, dy: 5 }]])
    const res = preventOverlap(boxes, offsets)
    expect(res.offsets.get('a')).toEqual({ dx: 10, dy: 5 })
    expect(res.corrected).toEqual([])
  })

  it('handles boxes with no offset entry (treated as zero nudge)', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 50, y: 0, w: 40, h: 40 },
    ]
    // only 'a' has an offset and it does not reach 'b'
    const offsets = new Map([['a', { dx: 5, dy: 0 }]])
    const res = preventOverlap(boxes, offsets)
    expect(res.corrected).toEqual([])
    expect(res.offsets.get('a')).toEqual({ dx: 5, dy: 0 })
  })

  it('returns offsets for every input box id', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 50, y: 0, w: 40, h: 40 },
      { id: 'c', x: 300, y: 0, w: 40, h: 40 },
    ]
    const offsets = new Map([
      ['a', { dx: 20, dy: 0 }],
      ['b', { dx: -20, dy: 0 }],
    ])
    const res = preventOverlap(boxes, offsets)
    for (const box of boxes) {
      expect(res.offsets.has(box.id)).toBe(true)
    }
  })

  it('is deterministic (same input -> same offsets and corrected order)', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 50, y: 0, w: 40, h: 40 },
    ]
    const mk = () =>
      new Map([
        ['a', { dx: 20, dy: 0 }],
        ['b', { dx: -20, dy: 0 }],
      ])
    const r1 = preventOverlap(boxes, mk())
    const r2 = preventOverlap(boxes, mk())
    expect([...r1.offsets.entries()]).toEqual([...r2.offsets.entries()])
    expect(r1.corrected).toEqual(r2.corrected)
  })

  it('does not mutate the input offsets map', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, w: 40, h: 40 },
      { id: 'b', x: 50, y: 0, w: 40, h: 40 },
    ]
    const offsets = new Map([
      ['a', { dx: 20, dy: 0 }],
      ['b', { dx: -20, dy: 0 }],
    ])
    preventOverlap(boxes, offsets)
    expect(offsets.get('a')).toEqual({ dx: 20, dy: 0 })
    expect(offsets.get('b')).toEqual({ dx: -20, dy: 0 })
  })
})
