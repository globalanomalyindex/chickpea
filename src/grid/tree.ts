/**
 * The exact-edge slice-tree primitive — the float-safety layer the whole grid engine stands on.
 *
 * A grid is a recursive GUILLOTINE partition of the unit square: the only operation is "replace a
 * leaf cell with children that exactly retile it." That operation is CLOSED under the tiling
 * invariant, so every grid we ever build is a zero-gap, in-bounds, area-1 tiling BY CONSTRUCTION —
 * never enforced or repaired post-hoc. (This is the grid analog of how the palette guarantees
 * in-gamut color by mapping rather than clipping.)
 *
 * The one floating-point hazard is nested fractional cuts accumulating rounding until a shared edge
 * is only epsilon-equal and a hairline gap shows. The mitigation is the whole reason this module
 * exists: a cut position is computed ONCE via `cut(lo,hi,f)` and the resulting double is handed
 * VERBATIM to both adjacent children (one as its high edge, one as its low edge). Shared edges are
 * therefore `===` bit-identical, not approximately equal — see `checkCrispGuides`. Cell endpoints
 * 0 and 1 are carried as literals from the root, so the outer boundary is exact too.
 */

import type { Axis, Module } from './types'

/** A rectangular region of the unit square, with the axis its parent was cut along + its tree depth. */
export interface Cell {
  x0: number
  x1: number
  y0: number
  y1: number
  /** the axis of the cut that *created* this cell's parent split (null at the root) — drives axis alternation. */
  axis: Axis | null
  depth: number
}

/** One interior cut, carrying the parent-relative fraction so its ratio can be labelled truthfully. */
export interface CutRef {
  axis: Axis
  /** absolute position in the unit square (0..1). */
  pos: number
  /** the cut's fraction OF ITS PARENT CELL on the cut axis — the proportion to label (e.g. 0.618 → "1/φ"). */
  frac: number
  /** parent cell extent on the cut axis (lo→hi), kept for annotation geometry. */
  lo: number
  hi: number
  depth: number
}

/** The shared-coordinate primitive: a cut at fraction `f` of [lo,hi]. Computed once, shared by both neighbours. */
export function cut(lo: number, hi: number, f: number): number {
  return lo + (hi - lo) * f
}

/** Convert a leaf cell to a normalized Module rect. Width/height are computed only here, at emit time. */
export function cellToModule(c: Cell): Module {
  return { x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0 }
}

/**
 * Split a cell along `axis` at the given interior fractions (each in (0,1), strictly increasing).
 * Returns the children (which exactly retile the cell) and one CutRef per interior boundary.
 *
 * The shared-edge guarantee: each interior boundary is a single double `b`, written as child[i].x1
 * AND child[i+1].x0 (the SAME value), so they are `===`. The outer endpoints reuse the parent's own
 * `x0`/`x1` literals. By construction the children's spans sum to the parent's span exactly.
 */
export function splitCell(c: Cell, axis: Axis, fracs: number[]): { children: Cell[]; cuts: CutRef[] } {
  const vertical = axis === 'v'
  const lo = vertical ? c.x0 : c.y0
  const hi = vertical ? c.x1 : c.y1
  const childDepth = c.depth + 1

  // interior boundaries, each computed once and reused as the shared edge of two children
  const interior = fracs.map((f) => cut(lo, hi, f))
  const bounds = [lo, ...interior, hi] // length k+1; ends are the parent's exact literals

  const children: Cell[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]
    const b = bounds[i + 1]
    children.push(
      vertical
        ? { x0: a, x1: b, y0: c.y0, y1: c.y1, axis, depth: childDepth }
        : { x0: c.x0, x1: c.x1, y0: a, y1: b, axis, depth: childDepth },
    )
  }

  const cuts: CutRef[] = fracs.map((f, i) => ({
    axis,
    pos: interior[i],
    frac: f,
    lo,
    hi,
    depth: c.depth,
  }))

  return { children, cuts }
}
