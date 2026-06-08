import type { Axis } from '../grid/types'

export type Edge = 'top' | 'bottom' | 'left' | 'right'
export interface Point {
  x: number
  y: number
}
export interface Rect {
  w: number
  h: number
}

const inside = (p: Point, rect: Rect, eps = 1e-9) =>
  p.x >= -eps && p.x <= rect.w + eps && p.y >= -eps && p.y <= rect.h + eps

/**
 * The cursor-entry-direction primitive (spec §2 / old §3). Given the previous and current
 * pointer positions relative to a rect's top-left origin, returns the edge the pointer
 * crossed to get inside — or null if `curr` is not inside or no edge was crossed.
 *
 * A corner entry (prev outside on two edges) is resolved deterministically by the larger
 * crossing displacement along each candidate edge's perpendicular axis, so the gesture
 * never flickers between axes at a corner.
 */
export function entryEdge(prev: Point, curr: Point, rect: Rect): Edge | null {
  // The current point must be inside the rect for this to count as an entry.
  if (!inside(curr, rect)) return null

  // Candidate edges: those the previous point was outside of (and thus crossed).
  const candidates: { edge: Edge; displacement: number }[] = []
  if (prev.y < 0) candidates.push({ edge: 'top', displacement: curr.y - prev.y })
  if (prev.y > rect.h) candidates.push({ edge: 'bottom', displacement: prev.y - curr.y })
  if (prev.x < 0) candidates.push({ edge: 'left', displacement: curr.x - prev.x })
  if (prev.x > rect.w) candidates.push({ edge: 'right', displacement: prev.x - curr.x })

  if (candidates.length === 0) return null

  // Largest crossing displacement wins (resolves the corner tie deterministically).
  candidates.sort((a, b) => b.displacement - a.displacement)
  return candidates[0].edge
}

/** Entering through top/bottom ⇒ vertical-cut mode; left/right ⇒ horizontal-cut mode. */
export function axisForEdge(edge: Edge): Axis {
  return edge === 'top' || edge === 'bottom' ? 'v' : 'h'
}
