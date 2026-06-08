import type { Module } from './types'

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
