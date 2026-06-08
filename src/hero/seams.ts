export interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface SeamGroup {
  group: string
  boxes: Box[] // in render order along the axis
  axis: 'x' | 'y' // 'x' = boxes are side-by-side; 'y' = stacked
}

export interface Seam {
  id: string
  group: string
  axis: 'v' | 'h' // 'v' = a vertical line separating left/right; 'h' = horizontal separating top/bottom
  center: { x: number; y: number }
  gap: number
  /** ids on each side, for the separation animation. */
  leftIds: string[]
  rightIds: string[]
  /** index of the gap (boxes[index] | boxes[index+1]). */
  index: number
}

export function buildSeams(groups: SeamGroup[]): Seam[] {
  const seams: Seam[] = []
  for (const g of groups) {
    const b = g.boxes
    for (let i = 0; i < b.length - 1; i++) {
      const a = b[i]
      const c = b[i + 1]
      if (g.axis === 'x') {
        const gap = c.x - (a.x + a.w)
        const cx = a.x + a.w + gap / 2
        const cy = a.y + a.h / 2
        seams.push({
          id: `${g.group}-${i}`,
          group: g.group,
          axis: 'v',
          center: { x: cx, y: cy },
          gap,
          leftIds: b.slice(0, i + 1).map((x) => x.id),
          rightIds: b.slice(i + 1).map((x) => x.id),
          index: i,
        })
      } else {
        const gap = c.y - (a.y + a.h)
        const cx = a.x + a.w / 2
        const cy = a.y + a.h + gap / 2
        seams.push({
          id: `${g.group}-${i}`,
          group: g.group,
          axis: 'h',
          center: { x: cx, y: cy },
          gap,
          leftIds: b.slice(0, i + 1).map((x) => x.id),
          rightIds: b.slice(i + 1).map((x) => x.id),
          index: i,
        })
      }
    }
  }
  return seams
}

export function nearestSeam(seams: Seam[], p: { x: number; y: number }, radius: number): Seam | null {
  let best: Seam | null = null
  let bestD = radius
  for (const s of seams) {
    const d = Math.hypot(s.center.x - p.x, s.center.y - p.y)
    if (d <= bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

/** Per-box separation offset (in artboard px) for an active seam, with falloff by distance from the seam index. */
export function separationOffset(seam: Seam, boxId: string, allIds: string[], delta: number): number {
  const idx = allIds.indexOf(boxId)
  if (idx < 0) return 0
  const side = idx <= seam.index ? -1 : 1
  const dist = side < 0 ? seam.index - idx : idx - (seam.index + 1)
  const falloff = Math.max(0, 1 - dist * 0.4) // neighbors move less
  return side * (delta / 2) * falloff
}
