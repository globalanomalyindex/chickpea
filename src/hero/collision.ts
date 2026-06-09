export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Positive-area axis-aligned intersection: rects that merely touch on an edge do NOT overlap. */
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Width of the x-axis overlap of two rects (>0 only when their horizontal extents truly overlap). */
function xOverlap(a: Rect, b: Rect): number {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
}

/** Width of the y-axis overlap of two rects. */
function yOverlap(a: Rect, b: Rect): number {
  return Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
}

/**
 * Push overlapping label rects apart vertically (minimal perpendicular displacement) so none
 * overlap. Returns a `dy` per index in input order; labels that don't collide get 0. Labels
 * separated on x are never displaced (they read fine side by side). Deterministic and stable:
 * resolves pairs in a fixed (sorted-by-y, then input-order) sweep and repeats until clear.
 *
 * The split is symmetric — the upper label moves up and the lower moves down by half the
 * overlap each — so the cluster stays centered on its original position.
 */
export function resolveLabelCollisions(labels: Rect[]): number[] {
  const dys = labels.map(() => 0)
  if (labels.length < 2) return dys

  // Cluster labels into groups that mutually collide (overlap on BOTH axes, directly or
  // through a chain). Labels separated on x never collide — they read fine side by side and
  // stay put (dy 0). Each cluster is then de-overlapped independently as a 1-D stack.
  const n = labels.length
  const parent = labels.map((_, i) => i)
  const findRoot = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (i: number, j: number) => {
    const ri = findRoot(i)
    const rj = findRoot(j)
    if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj)
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (overlaps(labels[i], labels[j])) union(i, j)
    }
  }

  const clusters = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = findRoot(i)
    const arr = clusters.get(r)
    if (arr) arr.push(i)
    else clusters.set(r, [i])
  }

  for (const members of clusters.values()) {
    if (members.length < 2) continue
    // sort top-to-bottom by current top edge (ties -> input index, for determinism)
    const order = [...members].sort((i, j) => {
      const dy = labels[i].y - labels[j].y
      return dy !== 0 ? dy : i - j
    })
    // pack downward: each label sits at least flush-below the previous (target top edge)
    const targetTop: number[] = []
    let floor = -Infinity
    for (const i of order) {
      const top = Math.max(labels[i].y, floor)
      targetTop.push(top)
      floor = top + labels[i].h
    }
    // recenter: shift the whole packed group so its center matches the original cluster center
    // (minimal, symmetric displacement — the upper labels go up, the lower go down)
    const origCenter =
      order.reduce((s, i) => s + labels[i].y + labels[i].h / 2, 0) / order.length
    const newCenter =
      order.reduce((s, i, k) => s + targetTop[k] + labels[i].h / 2, 0) / order.length
    const shift = origCenter - newCenter
    order.forEach((i, k) => {
      dys[i] = targetTop[k] + shift - labels[i].y
    })
  }

  return dys
}

/** A box in the relaxation solver. `pinned` boxes never move (e.g. the element under the cursor). */
export interface SolverBox extends Rect {
  id: string
  pinned?: boolean
}

/**
 * Global cascading overlap solver — the heart of "everything moves out of the way, down the chain,
 * and NOTHING ends up overlapping." Given a set of boxes (some `pinned`), it sweeps every pair and
 * separates any overlap along its axis of least penetration, applying each fix immediately
 * (Gauss-Seidel) and repeating until a whole sweep changes nothing. Immediate application is what
 * makes pushes PROPAGATE: when A displaces B this sweep, B↔C is resolved next sweep — so a dragged
 * box shoves a neighbor, which shoves its neighbor, until the chain is clear.
 *
 * Pinned boxes act as infinite mass (only the other box in a pair moves); two mobile boxes split
 * the separation by half each, so a cluster stays centered. PURE and DETERMINISTIC: it depends only
 * on the input positions, so seeding it from rest each frame and moving only the pinned (cursor) box
 * yields continuously-moving outputs — no rubberband. `pad` keeps a hair of breathing room.
 *
 * Returns a resolved {x,y} per id (pinned ids return their input position unchanged).
 */
export function relax(
  boxes: SolverBox[],
  opts: { passes?: number; pad?: number; skip?: Set<string> } = {},
): Map<string, { x: number; y: number }> {
  const n = boxes.length
  const pad = opts.pad ?? 0
  const skip = opts.skip
  const key = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a)
  // A box squeezed between a pinned box and a flush chain converges only as fast as the chain
  // relaxes (O(n²) sweeps in the worst case). The hero only ever has ~10 boxes, so a generous
  // quadratic budget is microseconds and guarantees the chain fully clears.
  const passes = opts.passes ?? Math.max(80, n * n * 10)
  // Overshoot each separation by a hair so pairs land STRICTLY disjoint instead of asymptotically
  // flush (which leaves a sub-pixel residual overlap). Invisible, and it lets the sweep early-exit.
  const EPS = 0.05
  const px = boxes.map((b) => b.x)
  const py = boxes.map((b) => b.y)
  const pinned = boxes.map((b) => !!b.pinned)

  for (let pass = 0; pass < passes; pass++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (pinned[i] && pinned[j]) continue
        // pairs that already overlap at REST (coarse bounding boxes that intersect by design, e.g.
        // a tall title's box vs the line below it) are preserved — only NEW overlap is resolved.
        if (skip && skip.has(key(boxes[i].id, boxes[j].id))) continue
        const aw = boxes[i].w
        const ah = boxes[i].h
        const bw = boxes[j].w
        const bh = boxes[j].h
        const penX = Math.min(px[i] + aw, px[j] + bw) - Math.max(px[i], px[j]) + pad
        const penY = Math.min(py[i] + ah, py[j] + bh) - Math.max(py[i], py[j]) + pad
        if (penX <= 0 || penY <= 0) continue
        const mi = pinned[i] ? 0 : 1
        const mj = pinned[j] ? 0 : 1
        const sum = mi + mj
        if (sum === 0) continue
        if (penX < penY) {
          const move = penX + EPS
          const dir = px[i] + aw / 2 <= px[j] + bw / 2 ? -1 : 1
          px[i] += dir * move * (mi / sum)
          px[j] -= dir * move * (mj / sum)
        } else {
          const move = penY + EPS
          const dir = py[i] + ah / 2 <= py[j] + bh / 2 ? -1 : 1
          py[i] += dir * move * (mi / sum)
          py[j] -= dir * move * (mj / sum)
        }
        moved = true
      }
    }
    if (!moved) break
  }

  const out = new Map<string, { x: number; y: number }>()
  boxes.forEach((b, i) => out.set(b.id, { x: px[i], y: py[i] }))
  return out
}

/** Pairs (by id) that already overlap at their given positions — pass to `relax`'s `skip` so a
 * coarse box that intersects a neighbor by design (a tall title vs the line below it) is preserved
 * and only NEW, induced overlaps get resolved. Keys match relax's internal `a b` (sorted) form. */
export function restOverlapPairs(boxes: SolverBox[]): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j])) {
        const a = boxes[i].id
        const b = boxes[j].id
        out.add(a < b ? a + '|' + b : b + '|' + a)
      }
    }
  }
  return out
}

/**
 * Place labels (numbers) so none overlaps any obstacle (word boxes / arrowheads) OR another label —
 * the "numbers never clash with anything" guarantee. Obstacles are pinned; labels are mobile and
 * relax out of every collision by minimal displacement (a label that already sits clear doesn't
 * move). Returns a {dx,dy} per label id in input order.
 */
export function layoutLabels(
  labels: SolverBox[],
  obstacles: Rect[],
  pad = 0,
): Map<string, { dx: number; dy: number }> {
  const boxes: SolverBox[] = [
    ...obstacles.map((o, k) => ({ id: `__obs_${k}`, x: o.x, y: o.y, w: o.w, h: o.h, pinned: true })),
    ...labels.map((l) => ({ id: l.id, x: l.x, y: l.y, w: l.w, h: l.h, pinned: false })),
  ]
  const res = relax(boxes, { pad, passes: Math.max(40, boxes.length * 8) })
  const out = new Map<string, { dx: number; dy: number }>()
  for (const l of labels) {
    const r = res.get(l.id)!
    out.set(l.id, { dx: r.x - l.x, dy: r.y - l.y })
  }
  return out
}

/** Does rect `a` overlap any rect in `words`? Axis-aligned, positive-area (edge touch = false). */
export function crossesAny(a: Rect, words: Rect[]): boolean {
  for (const w of words) {
    if (overlaps(a, w)) return true
  }
  return false
}

interface IdBox {
  id: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Clamp per-element nudge offsets so that, after nudging, no two element boxes overlap. Each
 * element's offset is scaled down uniformly (toward zero) just enough that any pair it would
 * collide with only touches — preserving the nudge direction while removing the overlap.
 * Returns a fresh offsets map (input is not mutated) plus the ids that were clamped, in stable
 * (input) order, for the auto-correction annotation.
 */
export function preventOverlap(
  boxes: IdBox[],
  offsets: Map<string, { dx: number; dy: number }>,
): { offsets: Map<string, { dx: number; dy: number }>; corrected: string[] } {
  // Work on a copy so the caller's map is never touched.
  const out = new Map<string, { dx: number; dy: number }>()
  for (const b of boxes) {
    const o = offsets.get(b.id) ?? { dx: 0, dy: 0 }
    out.set(b.id, { dx: o.dx, dy: o.dy })
  }

  const correctedSet = new Set<string>()
  const moved = (b: IdBox): Rect => {
    const o = out.get(b.id)!
    return { x: b.x + o.dx, y: b.y + o.dy, w: b.w, h: b.h }
  }

  // Iteratively scale back colliding offsets until no pair overlaps. Each pass shrinks the
  // offsets of the boxes in a colliding pair by the fraction needed to just clear the smaller
  // penetration axis. Bounded by the number of pairs; converges because each correction
  // strictly reduces the offset magnitude of at least one box.
  // Gauss-Seidel relaxation: scale back colliding offsets until no nudge-induced overlap
  // remains. Converges via the no-change early-break; the cap is a generous safety net for the
  // realistic regime (boxes disjoint at rest + small nudges — the hero's only inputs). A pair
  // overlapping at REST (no offsets to back off) is left untouched and NOT flagged: it is not a
  // nudge-induced collision, so it neither counts as "corrected" nor keeps the loop spinning.
  const MAX_PASSES = boxes.length * 24 + 64
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const ba = boxes[a]
        const bb = boxes[b]
        const ra = moved(ba)
        const rb = moved(bb)
        if (!overlaps(ra, rb)) continue

        const penX = xOverlap(ra, rb)
        const penY = yOverlap(ra, rb)
        const oa = out.get(ba.id)!
        const ob = out.get(bb.id)!

        // Resolve along the axis of least penetration; scale back whichever offsets drove the
        // pair together. If neither moved on that axis, try the other. `any` stays false when
        // there's nothing to back off (rest overlap) — so we don't spin or mis-flag.
        let any = false
        if (penX <= penY) {
          const tot = Math.abs(oa.dx) + Math.abs(ob.dx)
          if (tot > 0) {
            oa.dx -= Math.sign(oa.dx) * penX * (Math.abs(oa.dx) / tot)
            ob.dx -= Math.sign(ob.dx) * penX * (Math.abs(ob.dx) / tot)
            any = true
          } else {
            const totY = Math.abs(oa.dy) + Math.abs(ob.dy)
            if (totY > 0) {
              oa.dy -= Math.sign(oa.dy) * penY * (Math.abs(oa.dy) / totY)
              ob.dy -= Math.sign(ob.dy) * penY * (Math.abs(ob.dy) / totY)
              any = true
            }
          }
        } else {
          const tot = Math.abs(oa.dy) + Math.abs(ob.dy)
          if (tot > 0) {
            oa.dy -= Math.sign(oa.dy) * penY * (Math.abs(oa.dy) / tot)
            ob.dy -= Math.sign(ob.dy) * penY * (Math.abs(ob.dy) / tot)
            any = true
          } else {
            const totX = Math.abs(oa.dx) + Math.abs(ob.dx)
            if (totX > 0) {
              oa.dx -= Math.sign(oa.dx) * penX * (Math.abs(oa.dx) / totX)
              ob.dx -= Math.sign(ob.dx) * penX * (Math.abs(ob.dx) / totX)
              any = true
            }
          }
        }

        if (any) {
          changed = true
          const inA = offsets.get(ba.id) ?? { dx: 0, dy: 0 }
          const inB = offsets.get(bb.id) ?? { dx: 0, dy: 0 }
          if (oa.dx !== inA.dx || oa.dy !== inA.dy) correctedSet.add(ba.id)
          if (ob.dx !== inB.dx || ob.dy !== inB.dy) correctedSet.add(bb.id)
        }
      }
    }
    if (!changed) break
  }

  // corrected in stable input order
  const corrected = boxes.map((b) => b.id).filter((id) => correctedSet.has(id))
  return { offsets: out, corrected }
}
