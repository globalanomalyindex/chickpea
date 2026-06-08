import type { ColorWeight } from './kmeans'

export interface Swatch {
  rgb: [number, number, number]
  x: number
  y: number
  w: number
  h: number
}

interface FreeSquare {
  x: number
  y: number
  size: number // edge length; always a power of 1/2 so area is a power of 1/4
}

/** A free square split into its four equal quadrants, top-left first (reading order). */
function quadrants(sq: FreeSquare): FreeSquare[] {
  const half = sq.size / 2
  return [
    { x: sq.x, y: sq.y, size: half }, // top-left
    { x: sq.x + half, y: sq.y, size: half }, // top-right
    { x: sq.x, y: sq.y + half, size: half }, // bottom-left
    { x: sq.x + half, y: sq.y + half, size: half }, // bottom-right
  ]
}

/**
 * Per spec §5: pack weighted colors into the unit square as sub-squares — the dominant
 * color top-left, every cell a perfect square, the whole square tiled with no gaps.
 *
 * Procedure: normalize weights → quantize each to a count of dyadic cells at a chosen
 * granularity (areas 1, 1/4, 1/16, 1/64) → sort colors by descending weight → walk a
 * `freeSquares` list seeded with the unit square, splitting squares into quadrants as
 * needed to hand each color the cells its budget buys (top-left preferred). Any squares
 * left over after every color is placed are filled with the lowest-weight color. Pure
 * and deterministic.
 */
export function dyadicLayout(colors: ColorWeight[]): Swatch[] {
  if (colors.length === 0) return []

  // Work at a fixed dyadic resolution: the unit square as a GRID×GRID lattice of the
  // smallest cells (GRID = 8 → 64 cells, areas down to 1/64). Each color is allotted an
  // integer number of these smallest cells proportional to its weight, rounded so the
  // counts sum to exactly GRID*GRID.
  const GRID = 8
  const CELLS = GRID * GRID
  const total = colors.reduce((s, c) => s + c.weight, 0) || 1
  const sorted = [...colors].sort((a, b) => b.weight - a.weight)

  // largest-remainder rounding → integer cell counts that sum to CELLS, each color ≥ 1
  const exact = sorted.map((c) => (c.weight / total) * CELLS)
  const counts = exact.map((e) => Math.max(1, Math.floor(e)))
  let used = counts.reduce((s, n) => s + n, 0)
  // if min-1 floors overshoot CELLS, trim from the smallest colors upward
  for (let i = counts.length - 1; i >= 0 && used > CELLS; i--) {
    while (counts[i] > 1 && used > CELLS) {
      counts[i]--
      used--
    }
  }
  // distribute the remaining cells by largest fractional remainder
  const rema = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
  let r = 0
  while (used < CELLS) {
    counts[rema[r % rema.length].i]++
    used++
    r++
  }

  // Seed the free list with the unit square. Splitting is on demand into quadrants, so
  // every emitted cell is a true square and the union always tiles the unit square.
  const free: FreeSquare[] = [{ x: 0, y: 0, size: 1 }]
  const cellSize = 1 / GRID
  const out: Swatch[] = []

  // Pop the first free square whose area (in smallest-cells) is ≤ budget, splitting any
  // square that is too large into quadrants (re-queued top-left first). This packs the
  // largest squares a color's budget can afford while preserving reading order.
  const placeCells = (rgb: [number, number, number], budgetCells: number) => {
    let remaining = budgetCells
    while (remaining > 0 && free.length > 0) {
      const sq = free[0]
      const sqCells = Math.round((sq.size / cellSize) ** 2)
      if (sqCells <= remaining) {
        free.shift()
        out.push({ rgb, x: sq.x, y: sq.y, w: sq.size, h: sq.size })
        remaining -= sqCells
      } else {
        // too big — split into quadrants and retry (top-left handled first)
        free.shift()
        free.unshift(...quadrants(sq))
      }
    }
  }

  for (let i = 0; i < sorted.length; i++) placeCells(sorted[i].rgb, counts[i])

  // Any leftover squares (rounding slack) go to the lowest-weight color.
  if (free.length > 0) {
    const fill = sorted[sorted.length - 1].rgb
    for (const sq of free) out.push({ rgb: fill, x: sq.x, y: sq.y, w: sq.size, h: sq.size })
    free.length = 0
  }

  return out
}
