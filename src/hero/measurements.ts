export interface Box {
  id: string
  kind: 'letter' | 'word' | 'block'
  x: number
  y: number
  w: number
  h: number
}
export interface Artboard {
  w: number
  h: number
}
export interface Pt {
  x: number
  y: number
}

export type Measurement =
  | {
      id: string
      type: 'gap'
      axis: 'v' | 'h'
      aId: string
      bId: string
      gap: number
      // span endpoints (artboard px) of the gap along the separating axis:
      span: { x1: number; y1: number; x2: number; y2: number }
      // the line on which the two elements sit (for cursor projection):
      lo: number
      hi: number // shared perpendicular extent (y-range for axis 'v', x-range for 'h')
    }
  | {
      id: string
      type: 'margin'
      side: 'left' | 'right' | 'top' | 'bottom'
      elId: string
      dist: number
      span: { x1: number; y1: number; x2: number; y2: number }
      lo: number
      hi: number // the element's extent along the border
    }

export interface Selected {
  m: Measurement
  strength: number
} // strength 0..1 by cursor proximity

/** Overlap of two closed intervals; returns [lo,hi] or null if they don't overlap. */
function overlap(a0: number, a1: number, b0: number, b1: number): [number, number] | null {
  const lo = Math.max(a0, b0)
  const hi = Math.min(a1, b1)
  return hi > lo ? [lo, hi] : null
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Cluster boxes whose extents along `axis` substantially overlap. axis 'y' groups boxes
 * onto shared horizontal rows (same line of text); axis 'x' groups boxes into shared
 * vertical columns (stacked lines / blocks). A minimum overlap fraction prevents merely
 * touching side-by-side boxes (e.g. tightly-kerned letters, ~0 x-overlap) from being
 * mistaken for a column, and touching stacked lines (~0 y-overlap) from being a row.
 */
function clusterByOverlap(boxes: Box[], axis: 'x' | 'y'): Box[][] {
  const lo = (b: Box) => (axis === 'y' ? b.y : b.x)
  const hi = (b: Box) => (axis === 'y' ? b.y + b.h : b.x + b.w)
  const enough = (o: Box, b: Box) => {
    const ov = overlap(lo(o), hi(o), lo(b), hi(b))
    if (!ov) return false
    const minExt = Math.min(hi(o) - lo(o), hi(b) - lo(b))
    return minExt > 0 && (ov[1] - ov[0]) >= 0.35 * minExt
  }
  const sorted = [...boxes].sort((a, b) => lo(a) - lo(b))
  const clusters: Box[][] = []
  for (const b of sorted) {
    const target = clusters.find((c) => c.some((o) => enough(o, b)))
    if (target) target.push(b)
    else clusters.push([b])
  }
  return clusters
}

/**
 * Group boxes (by kind) into rows (shared y-overlap -> 'v' gaps between x-adjacent
 * neighbors) and columns (shared x-overlap -> 'h' gaps between y-adjacent neighbors),
 * then emit a gap per adjacent neighbor pair. Bucketing into rows/columns FIRST is what
 * keeps a same-line word gap (e.g. robin->fiore) from being dropped when a word from
 * another line x-interleaves between them. Letters form one row; words within a line form
 * a row; stacked lines/blocks form a column.
 */
export function buildGaps(boxes: Box[]): Measurement[] {
  const gaps: Measurement[] = []
  const kinds = ['letter', 'word', 'block'] as const

  for (const kind of kinds) {
    const group = boxes.filter((b) => b.kind === kind)

    // rows (shared y) -> vertical gaps between x-adjacent neighbors
    for (const row of clusterByOverlap(group, 'y')) {
      const byX = [...row].sort((a, b) => a.x - b.x)
      for (let i = 0; i < byX.length - 1; i++) {
        const a = byX[i]
        const c = byX[i + 1]
        const ov = overlap(a.y, a.y + a.h, c.y, c.y + c.h)
        if (!ov) continue
        const yMid = (ov[0] + ov[1]) / 2
        gaps.push({
          id: `gap-${kind}-${a.id}-${c.id}`,
          type: 'gap',
          axis: 'v',
          aId: a.id,
          bId: c.id,
          gap: c.x - (a.x + a.w),
          span: { x1: a.x + a.w, y1: yMid, x2: c.x, y2: yMid },
          lo: ov[0],
          hi: ov[1],
        })
      }
    }

    // columns (shared x) -> horizontal gaps between y-adjacent neighbors
    for (const col of clusterByOverlap(group, 'x')) {
      const byY = [...col].sort((a, b) => a.y - b.y)
      for (let i = 0; i < byY.length - 1; i++) {
        const a = byY[i]
        const c = byY[i + 1]
        const ov = overlap(a.x, a.x + a.w, c.x, c.x + c.w)
        if (!ov) continue
        const xMid = (ov[0] + ov[1]) / 2
        gaps.push({
          id: `gap-${kind}-${a.id}-${c.id}`,
          type: 'gap',
          axis: 'h',
          aId: a.id,
          bId: c.id,
          gap: c.y - (a.y + a.h),
          span: { x1: xMid, y1: a.y + a.h, x2: xMid, y2: c.y },
          lo: ov[0],
          hi: ov[1],
        })
      }
    }
  }

  return gaps
}

/**
 * Four margin measurements per word|block box: the distance from each artboard border
 * to the nearest element edge. `span` runs border->element edge; `[lo,hi]` is the
 * element's extent along that border.
 */
export function buildMargins(boxes: Box[], art: Artboard): Measurement[] {
  const margins: Measurement[] = []
  for (const b of boxes) {
    if (b.kind !== 'word' && b.kind !== 'block') continue
    const elLeft = b.x
    const elRight = b.x + b.w
    const elTop = b.y
    const elBottom = b.y + b.h
    const yMid = b.y + b.h / 2
    const xMid = b.x + b.w / 2

    margins.push({
      id: `margin-left-${b.id}`,
      type: 'margin',
      side: 'left',
      elId: b.id,
      dist: elLeft,
      span: { x1: 0, y1: yMid, x2: elLeft, y2: yMid },
      lo: elTop,
      hi: elBottom,
    })
    margins.push({
      id: `margin-right-${b.id}`,
      type: 'margin',
      side: 'right',
      elId: b.id,
      dist: art.w - elRight,
      span: { x1: elRight, y1: yMid, x2: art.w, y2: yMid },
      lo: elTop,
      hi: elBottom,
    })
    margins.push({
      id: `margin-top-${b.id}`,
      type: 'margin',
      side: 'top',
      elId: b.id,
      dist: elTop,
      span: { x1: xMid, y1: 0, x2: xMid, y2: elTop },
      lo: elLeft,
      hi: elRight,
    })
    margins.push({
      id: `margin-bottom-${b.id}`,
      type: 'margin',
      side: 'bottom',
      elId: b.id,
      dist: art.h - elBottom,
      span: { x1: xMid, y1: elBottom, x2: xMid, y2: art.h },
      lo: elLeft,
      hi: elRight,
    })
  }
  return margins
}

export function buildMeasurements(boxes: Box[], art: Artboard): Measurement[] {
  return [...buildGaps(boxes), ...buildMargins(boxes, art)]
}

/**
 * Distance from `p` to the measurement plus the cursor-tracked draw point. The track
 * point projects `p` onto the measurement's perpendicular extent. A margin is only
 * relevant when the cursor is actually within its band (the negative space between the
 * border and the element, across the element's extent). Strength = max(0, 1 - d/radius).
 */
export function cursorRelevance(m: Measurement, p: Pt, radius: number): { strength: number; track: Pt } {
  if (m.type === 'gap') {
    if (m.axis === 'v') {
      const lineX = m.span.x1 + (m.span.x2 - m.span.x1) / 2 // gap center x
      const ty = clamp(p.y, m.lo, m.hi)
      const d = Math.hypot(p.x - lineX, p.y - ty)
      return { strength: Math.max(0, 1 - d / radius), track: { x: lineX, y: ty } }
    }
    const lineY = m.span.y1 + (m.span.y2 - m.span.y1) / 2 // gap center y
    const tx = clamp(p.x, m.lo, m.hi)
    const d = Math.hypot(p.x - tx, p.y - lineY)
    return { strength: Math.max(0, 1 - d / radius), track: { x: tx, y: lineY } }
  }

  // margin: gated to its band, distance measured perpendicular to the border
  // distance is measured to the ELEMENT edge (so the margin lights up when the cursor is
  // near the word in the negative space), not to the far page border.
  if (m.side === 'left' || m.side === 'right') {
    const inExtent = p.y >= m.lo && p.y <= m.hi
    const elEdge = m.side === 'left' ? m.span.x2 : m.span.x1
    const inBand = m.side === 'left' ? p.x < elEdge : p.x > elEdge
    if (!inExtent || !inBand) return { strength: 0, track: { x: p.x, y: clamp(p.y, m.lo, m.hi) } }
    const d = Math.abs(p.x - elEdge)
    return { strength: Math.max(0, 1 - d / radius), track: { x: p.x, y: clamp(p.y, m.lo, m.hi) } }
  }

  const inExtent = p.x >= m.lo && p.x <= m.hi
  const elEdge = m.side === 'top' ? m.span.y2 : m.span.y1
  const inBand = m.side === 'top' ? p.y < elEdge : p.y > elEdge
  if (!inExtent || !inBand) return { strength: 0, track: { x: clamp(p.x, m.lo, m.hi), y: p.y } }
  const d = Math.abs(p.y - elEdge)
  return { strength: Math.max(0, 1 - d / radius), track: { x: clamp(p.x, m.lo, m.hi), y: p.y } }
}

/**
 * Rank all measurements by cursor proximity: compute relevance, drop strength 0, sort
 * descending, take the top `maxCount`. The first entry is the "primary".
 */
export function selectMeasurements(
  ms: Measurement[],
  p: Pt,
  { maxCount, radius }: { maxCount: number; radius: number },
): Selected[] {
  return ms
    .map((m) => ({ m, strength: cursorRelevance(m, p, radius).strength }))
    .filter((s) => s.strength > 0)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, maxCount)
}

/**
 * Net transient nudge per element id, summed across the selected measurements and scaled
 * by strength. Gaps push their pair apart along the separating axis; margins push the
 * element away from its border (opening the margin).
 */
export function elementOffsets(selected: Selected[], delta: number): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>()
  const bump = (id: string, dx: number, dy: number) => {
    const cur = out.get(id) ?? { dx: 0, dy: 0 }
    cur.dx += dx
    cur.dy += dy
    out.set(id, cur)
  }

  for (const { m, strength } of selected) {
    if (m.type === 'gap') {
      const s = (delta * strength) / 2
      if (m.axis === 'v') {
        bump(m.aId, -s, 0)
        bump(m.bId, s, 0)
      } else {
        bump(m.aId, 0, -s)
        bump(m.bId, 0, s)
      }
    } else {
      const s = delta * strength
      switch (m.side) {
        case 'left':
          bump(m.elId, s, 0)
          break
        case 'right':
          bump(m.elId, -s, 0)
          break
        case 'top':
          bump(m.elId, 0, s)
          break
        case 'bottom':
          bump(m.elId, 0, -s)
          break
      }
    }
  }

  return out
}
