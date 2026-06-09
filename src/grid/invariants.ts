import type { Grid, Module } from './types'

export function checkBounds(modules: Module[], eps = 1e-9): boolean {
  return modules.every(
    (m) =>
      m.x >= -eps &&
      m.y >= -eps &&
      m.w > eps &&
      m.h > eps &&
      m.x + m.w <= 1 + eps &&
      m.y + m.h <= 1 + eps,
  )
}

function overlapArea(a: Module, b: Module): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return ox * oy
}

export function checkTiling(
  modules: Module[],
  eps = 1e-6,
): { covered: boolean; disjoint: boolean; area: number; overlap: number } {
  const area = modules.reduce((s, m) => s + m.w * m.h, 0)
  let overlap = 0
  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      overlap += overlapArea(modules[i], modules[j])
    }
  }
  return {
    covered: Math.abs(area - 1) <= eps && overlap <= eps,
    disjoint: overlap <= eps,
    area,
    overlap,
  }
}

/**
 * Every guide must lie EXACTLY on a real module edge (bit-identical, not epsilon-near). Because the
 * slice-tree shares each cut coordinate verbatim between neighbours (tree.ts), the cell on the far
 * side of a cut has its low edge `=== guide.pos`. If this fails while `checkTiling` passes, the
 * signature is an (x, w) regression — someone recomputed a guide position instead of reusing the
 * shared edge — which would show as a hairline that misses its modules in the Reveal overlay/export.
 */
export function checkCrispGuides(grid: Grid): boolean {
  for (const g of grid.guides) {
    const onEdge = grid.modules.some((m) => (g.axis === 'v' ? m.x === g.pos : m.y === g.pos))
    if (!onEdge) return false
  }
  return true
}
