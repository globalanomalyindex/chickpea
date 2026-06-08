import { describe, it, expect } from 'vitest'
import {
  buildGaps,
  buildMargins,
  buildMeasurements,
  cursorRelevance,
  selectMeasurements,
  elementOffsets,
  type Box,
  type Artboard,
  type Measurement,
} from './measurements'

// three letters in a row, each 100 wide, 200 tall, with 20px gaps
const letters: Box[] = [
  { id: 'C', kind: 'letter', x: 0, y: 0, w: 100, h: 200 },
  { id: 'h', kind: 'letter', x: 120, y: 0, w: 100, h: 200 },
  { id: 'i', kind: 'letter', x: 240, y: 0, w: 100, h: 200 },
]

// two stacked blocks (same x extent), 20px vertical gap
const blocks: Box[] = [
  { id: 'b0', kind: 'block', x: 0, y: 0, w: 300, h: 50 },
  { id: 'b1', kind: 'block', x: 0, y: 70, w: 300, h: 50 },
]

function find(ms: Measurement[], pred: (m: Measurement) => boolean): Measurement {
  const m = ms.find(pred)
  if (!m) throw new Error('measurement not found')
  return m
}

describe('buildGaps — rows (horizontal neighbors -> vertical gaps)', () => {
  it('creates one v-gap per adjacent pair of letters', () => {
    const gaps = buildGaps(letters)
    expect(gaps.length).toBe(2)
    for (const g of gaps) expect(g.type).toBe('gap')
    const g0 = gaps[0]
    if (g0.type !== 'gap') throw new Error('expected gap')
    expect(g0.axis).toBe('v')
    expect(g0.gap).toBeCloseTo(20, 6)
    expect(g0.aId).toBe('C')
    expect(g0.bId).toBe('h')
  })

  it('spans the facing edges and shares the perpendicular (y) extent', () => {
    const gaps = buildGaps(letters)
    const g0 = gaps[0]
    if (g0.type !== 'gap') throw new Error('expected gap')
    // facing edges: right of C (x=100) -> left of h (x=120), centered on shared y
    expect(g0.span.x1).toBeCloseTo(100, 6)
    expect(g0.span.x2).toBeCloseTo(120, 6)
    expect(g0.span.y1).toBeCloseTo(g0.span.y2, 6)
    // shared y-range of the two boxes
    expect(g0.lo).toBeCloseTo(0, 6)
    expect(g0.hi).toBeCloseTo(200, 6)
  })
})

describe('buildGaps — columns (stacked neighbors -> horizontal gaps)', () => {
  it('creates one h-gap for two stacked blocks', () => {
    const gaps = buildGaps(blocks)
    expect(gaps.length).toBe(1)
    const g = gaps[0]
    if (g.type !== 'gap') throw new Error('expected gap')
    expect(g.axis).toBe('h')
    expect(g.gap).toBeCloseTo(20, 6)
    expect(g.aId).toBe('b0')
    expect(g.bId).toBe('b1')
    // facing edges: bottom of b0 (y=50) -> top of b1 (y=70)
    expect(g.span.y1).toBeCloseTo(50, 6)
    expect(g.span.y2).toBeCloseTo(70, 6)
    expect(g.span.x1).toBeCloseTo(g.span.x2, 6)
    // shared x-range
    expect(g.lo).toBeCloseTo(0, 6)
    expect(g.hi).toBeCloseTo(300, 6)
  })
})

describe('buildGaps — grouping by kind and adjacency', () => {
  it('does not pair boxes of different kinds', () => {
    const mixed: Box[] = [
      { id: 'w0', kind: 'word', x: 0, y: 0, w: 50, h: 20 },
      { id: 'b0', kind: 'block', x: 70, y: 0, w: 50, h: 20 },
    ]
    expect(buildGaps(mixed).length).toBe(0)
  })

  it('does not pair non-overlapping boxes (different rows)', () => {
    const twoRows: Box[] = [
      { id: 'a', kind: 'word', x: 0, y: 0, w: 50, h: 20 },
      { id: 'b', kind: 'word', x: 70, y: 100, w: 50, h: 20 }, // far below, no y overlap, no x overlap
    ]
    expect(buildGaps(twoRows).length).toBe(0)
  })

  it('is deterministic (stable for the same input)', () => {
    const a = buildGaps(letters)
    const b = buildGaps(letters)
    expect(a).toEqual(b)
  })
})

describe('buildMargins', () => {
  const art: Artboard = { w: 1000, h: 800 }
  const box: Box = { id: 'w', kind: 'word', x: 100, y: 200, w: 300, h: 100 }

  it('produces four margins with correct distances for a word', () => {
    const ms = buildMargins([box], art)
    expect(ms.length).toBe(4)
    const left = find(ms, (m) => m.type === 'margin' && m.side === 'left')
    const right = find(ms, (m) => m.type === 'margin' && m.side === 'right')
    const top = find(ms, (m) => m.type === 'margin' && m.side === 'top')
    const bottom = find(ms, (m) => m.type === 'margin' && m.side === 'bottom')
    if (left.type !== 'margin') throw new Error('margin')
    if (right.type !== 'margin') throw new Error('margin')
    if (top.type !== 'margin') throw new Error('margin')
    if (bottom.type !== 'margin') throw new Error('margin')
    expect(left.dist).toBeCloseTo(100, 6) // x
    expect(right.dist).toBeCloseTo(1000 - (100 + 300), 6) // art.w - (x+w) = 600
    expect(top.dist).toBeCloseTo(200, 6) // y
    expect(bottom.dist).toBeCloseTo(800 - (200 + 100), 6) // art.h - (y+h) = 500
  })

  it('spans border->element edge and carries the element extent along the border', () => {
    const ms = buildMargins([box], art)
    const left = find(ms, (m) => m.type === 'margin' && m.side === 'left')
    if (left.type !== 'margin') throw new Error('margin')
    // left margin: x runs 0 -> elementLeft(100); lo/hi is the element's y extent
    expect(left.span.x1).toBeCloseTo(0, 6)
    expect(left.span.x2).toBeCloseTo(100, 6)
    expect(left.lo).toBeCloseTo(200, 6)
    expect(left.hi).toBeCloseTo(300, 6)

    const top = find(ms, (m) => m.type === 'margin' && m.side === 'top')
    if (top.type !== 'margin') throw new Error('margin')
    // top margin: y runs 0 -> elementTop(200); lo/hi is the element's x extent
    expect(top.span.y1).toBeCloseTo(0, 6)
    expect(top.span.y2).toBeCloseTo(200, 6)
    expect(top.lo).toBeCloseTo(100, 6)
    expect(top.hi).toBeCloseTo(400, 6)
  })

  it('ignores letter boxes (only word|block get margins)', () => {
    const ms = buildMargins([{ id: 'L', kind: 'letter', x: 10, y: 10, w: 5, h: 5 }], art)
    expect(ms.length).toBe(0)
  })
})

describe('buildMeasurements', () => {
  it('is the concatenation of gaps and margins', () => {
    const art: Artboard = { w: 1000, h: 800 }
    const boxes: Box[] = [
      { id: 'w0', kind: 'word', x: 0, y: 0, w: 50, h: 20 },
      { id: 'w1', kind: 'word', x: 70, y: 0, w: 50, h: 20 },
    ]
    const ms = buildMeasurements(boxes, art)
    const gaps = buildGaps(boxes)
    const margins = buildMargins(boxes, art)
    expect(ms.length).toBe(gaps.length + margins.length)
    expect(ms.length).toBe(1 + 8) // 1 gap + 4 margins each
  })

  it('gives every measurement a unique id', () => {
    const art: Artboard = { w: 1000, h: 800 }
    const boxes: Box[] = [
      { id: 'w0', kind: 'word', x: 0, y: 0, w: 50, h: 20 },
      { id: 'w1', kind: 'word', x: 70, y: 0, w: 50, h: 20 },
    ]
    const ids = buildMeasurements(boxes, art).map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('cursorRelevance — gaps', () => {
  const gap = buildGaps(letters)[0] // v-gap between C and h, gap center x=110, y∈[0,200]

  it('returns strength 1 at the measurement and projects the track point onto the extent', () => {
    const r = cursorRelevance(gap, { x: 110, y: 100 }, 150)
    expect(r.strength).toBeCloseTo(1, 6)
    expect(r.track.x).toBeCloseTo(110, 6) // gap center x
    expect(r.track.y).toBeCloseTo(100, 6) // projected onto [0,200]
  })

  it('clamps the track point to the perpendicular extent', () => {
    const r = cursorRelevance(gap, { x: 110, y: 500 }, 150)
    expect(r.track.y).toBeCloseTo(200, 6) // clamped to hi
  })

  it('falls off linearly with distance and is 0 outside the radius', () => {
    const radius = 100
    // 50px away along x from center (perpendicular distance to the line)
    const r = cursorRelevance(gap, { x: 160, y: 100 }, radius)
    expect(r.strength).toBeCloseTo(1 - 50 / 100, 6)
    const out = cursorRelevance(gap, { x: 110 + radius + 10, y: 100 }, radius)
    expect(out.strength).toBe(0)
  })
})

describe('cursorRelevance — margins band gating', () => {
  const art: Artboard = { w: 1000, h: 800 }
  const box: Box = { id: 'w', kind: 'word', x: 100, y: 200, w: 300, h: 100 }
  const left = buildMargins([box], art).find(
    (m) => m.type === 'margin' && m.side === 'left',
  ) as Extract<Measurement, { type: 'margin' }>

  it('is relevant only when the cursor is in the margin band', () => {
    // in band: left of the element (x<100) and within its y-extent
    const inBand = cursorRelevance(left, { x: 50, y: 250 }, 150)
    expect(inBand.strength).toBeGreaterThan(0)

    // outside the band on x (cursor is to the RIGHT of the element's left edge)
    const wrongX = cursorRelevance(left, { x: 200, y: 250 }, 150)
    expect(wrongX.strength).toBe(0)

    // outside the band on y (above the element's extent)
    const wrongY = cursorRelevance(left, { x: 50, y: 0 }, 150)
    expect(wrongY.strength).toBe(0)
  })

  it('tracks along the border extent (y clamped) for a left margin', () => {
    const r = cursorRelevance(left, { x: 50, y: 250 }, 150)
    expect(r.track.y).toBeCloseTo(250, 6)
  })
})

describe('selectMeasurements', () => {
  const art: Artboard = { w: 1000, h: 800 }
  const boxes: Box[] = [
    { id: 'C', kind: 'letter', x: 0, y: 0, w: 100, h: 200 },
    { id: 'h', kind: 'letter', x: 120, y: 0, w: 100, h: 200 },
    { id: 'i', kind: 'letter', x: 240, y: 0, w: 100, h: 200 },
  ]
  const ms = buildMeasurements(boxes, art)

  it('returns at most maxCount, sorted descending by strength, none at strength 0', () => {
    const sel = selectMeasurements(ms, { x: 110, y: 100 }, { maxCount: 2, radius: 200 })
    expect(sel.length).toBeLessThanOrEqual(2)
    for (let i = 1; i < sel.length; i++) {
      expect(sel[i - 1].strength).toBeGreaterThanOrEqual(sel[i].strength)
    }
    for (const s of sel) expect(s.strength).toBeGreaterThan(0)
  })

  it('places the nearest measurement as the primary (first)', () => {
    const sel = selectMeasurements(ms, { x: 110, y: 100 }, { maxCount: 4, radius: 200 })
    const primary = sel[0].m
    if (primary.type !== 'gap') throw new Error('expected the C|h gap as primary')
    expect(primary.aId).toBe('C')
    expect(primary.bId).toBe('h')
  })

  it('returns nothing when the cursor is far from everything', () => {
    const sel = selectMeasurements(ms, { x: 5000, y: 5000 }, { maxCount: 4, radius: 150 })
    expect(sel.length).toBe(0)
  })

  it('is deterministic', () => {
    const a = selectMeasurements(ms, { x: 110, y: 100 }, { maxCount: 4, radius: 200 })
    const b = selectMeasurements(ms, { x: 110, y: 100 }, { maxCount: 4, radius: 200 })
    expect(a).toEqual(b)
  })
})

describe('elementOffsets', () => {
  it('pushes the two sides of a v-gap apart along x, scaled by strength', () => {
    const gap = buildGaps(letters)[0] // C | h, axis 'v'
    const offs = elementOffsets([{ m: gap, strength: 1 }], 26)
    expect(offs.get('C')!.dx).toBeCloseTo(-13, 6)
    expect(offs.get('h')!.dx).toBeCloseTo(13, 6)
    expect(offs.get('C')!.dy).toBeCloseTo(0, 6)
    expect(offs.get('h')!.dy).toBeCloseTo(0, 6)

    const half = elementOffsets([{ m: gap, strength: 0.5 }], 26)
    expect(half.get('C')!.dx).toBeCloseTo(-13 * 0.5, 6)
    expect(half.get('h')!.dx).toBeCloseTo(13 * 0.5, 6)
  })

  it('pushes the two sides of an h-gap apart along y', () => {
    const gap = buildGaps(blocks)[0] // b0 | b1, axis 'h'
    const offs = elementOffsets([{ m: gap, strength: 1 }], 26)
    expect(offs.get('b0')!.dy).toBeCloseTo(-13, 6)
    expect(offs.get('b1')!.dy).toBeCloseTo(13, 6)
    expect(offs.get('b0')!.dx).toBeCloseTo(0, 6)
  })

  it('nudges a margin element away from its border, scaled by strength', () => {
    const art: Artboard = { w: 1000, h: 800 }
    const box: Box = { id: 'w', kind: 'word', x: 100, y: 200, w: 300, h: 100 }
    const margins = buildMargins([box], art)
    const left = margins.find((m) => m.type === 'margin' && m.side === 'left')!
    const right = margins.find((m) => m.type === 'margin' && m.side === 'right')!
    const top = margins.find((m) => m.type === 'margin' && m.side === 'top')!
    const bottom = margins.find((m) => m.type === 'margin' && m.side === 'bottom')!

    expect(elementOffsets([{ m: left, strength: 1 }], 26).get('w')!.dx).toBeCloseTo(26, 6) // away from left border -> +x
    expect(elementOffsets([{ m: right, strength: 1 }], 26).get('w')!.dx).toBeCloseTo(-26, 6) // away from right -> -x
    expect(elementOffsets([{ m: top, strength: 1 }], 26).get('w')!.dy).toBeCloseTo(26, 6) // away from top -> +y
    expect(elementOffsets([{ m: bottom, strength: 1 }], 26).get('w')!.dy).toBeCloseTo(-26, 6) // away from bottom -> -y

    expect(elementOffsets([{ m: left, strength: 0.5 }], 26).get('w')!.dx).toBeCloseTo(13, 6)
  })

  it('sums contributions across selected measurements per element', () => {
    const art: Artboard = { w: 1000, h: 800 }
    const box: Box = { id: 'w', kind: 'word', x: 100, y: 200, w: 300, h: 100 }
    const margins = buildMargins([box], art)
    const left = margins.find((m) => m.type === 'margin' && m.side === 'left')!
    const top = margins.find((m) => m.type === 'margin' && m.side === 'top')!
    const offs = elementOffsets(
      [
        { m: left, strength: 1 },
        { m: top, strength: 1 },
      ],
      26,
    )
    expect(offs.get('w')!.dx).toBeCloseTo(26, 6)
    expect(offs.get('w')!.dy).toBeCloseTo(26, 6)
  })

  it('is deterministic and skips zero-strength entries cleanly', () => {
    const gap = buildGaps(letters)[0]
    const a = elementOffsets([{ m: gap, strength: 0 }], 26)
    expect(a.get('C')!.dx).toBeCloseTo(0, 6)
    expect(a.get('h')!.dx).toBeCloseTo(0, 6)
  })
})

describe('cursorRelevance — deep margin proximity is to the word edge, not the page border', () => {
  // a word deep in the artboard: a 198px-wide left margin (like the real hero's negative space)
  const art: Artboard = { w: 758, h: 1024 }
  const box: Box = { id: 'p', kind: 'word', x: 560, y: 400, w: 120, h: 48 }
  const left = buildMargins([box], art).find(
    (m) => m.type === 'margin' && m.side === 'left',
  ) as Extract<Measurement, { type: 'margin' }>

  it('lights up when hovering just outside the word, not at the page edge', () => {
    const nearWord = cursorRelevance(left, { x: 540, y: 424 }, 150) // 20px left of the word edge
    const nearEdge = cursorRelevance(left, { x: 20, y: 424 }, 150) // by the page border, far from the word
    expect(nearWord.strength).toBeGreaterThan(0.8)
    expect(nearEdge.strength).toBe(0) // 540px from the word edge -> well outside the radius
    expect(nearWord.strength).toBeGreaterThan(nearEdge.strength)
  })
})

describe('buildGaps — same-row gaps survive an interleaving box from another row', () => {
  it('keeps the w00->w01 gap even though w10 x-interleaves between them', () => {
    const words: Box[] = [
      { id: 'w00', kind: 'word', x: 100, y: 0, w: 40, h: 40 },
      { id: 'w01', kind: 'word', x: 300, y: 0, w: 40, h: 40 }, // same row as w00
      { id: 'w10', kind: 'word', x: 200, y: 60, w: 40, h: 40 }, // next row, x-between w00 and w01
    ]
    const gaps = buildGaps(words)
    const same = gaps.find((g) => g.type === 'gap' && g.aId === 'w00' && g.bId === 'w01')
    expect(same).toBeDefined()
    if (same && same.type === 'gap') {
      expect(same.axis).toBe('v')
      expect(same.gap).toBeCloseTo(160, 6) // 300 - (100+40)
    }
  })
})
