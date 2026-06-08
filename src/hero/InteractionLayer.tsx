import { useEffect, useRef } from 'react'
import { clientToStage, type Stage } from './stageScale'
import {
  buildMeasurements,
  selectMeasurements,
  cursorRelevance,
  elementOffsets,
  type Box,
} from './measurements'
import {
  resolveLabelCollisions,
  crossesAny,
  preventOverlap,
  type Rect,
} from './collision'
import { ARTBOARD, HERO_COLORS } from './heroLayout'
import {
  measureBoxes,
  queryReactiveEls,
  type PlacementMap,
} from './heroDom'

/**
 * InteractionLayer — the single, unified, buttery interaction engine for the hero.
 *
 * Replaces MeasureLayer + DragLayer. ONE React mount, ONE imperative `requestAnimationFrame`
 * loop, ZERO React state in the hot path (everything is refs + direct DOM writes), and ZERO
 * per-frame layout reads (resting boxes are cached on mount / ResizeObserver / after a
 * placement change — never via `getBoundingClientRect` inside the loop).
 *
 * One mode, no toggle:
 *  - HOVER measures: `selectMeasurements` over the cached boxes lights up cursor-tracked
 *    dimension arrows; nearby elements spring apart by a transient nudge (lerped each frame),
 *    clamped by `preventOverlap` so words never overlap (corrected ones get a small ≠ tick).
 *  - DRAG (pointerdown on a [data-word]/[data-block]) moves the element 1:1 with snap (the
 *    DragLayer snap math, against the cached boxes), drawing live border/neighbor/guide
 *    annotations; pointerup commits the placement (the only setState — rare) and remeasures.
 *
 * emil law, strictly:
 *  - Only `transform` / `opacity` animate. Arrows track the cursor 1:1 via `transform` set
 *    each frame with NO transition; only `opacity` transitions (150ms) for appear/disappear.
 *  - Instant response to input (pointer ref read live every frame).
 *  - Springs ONLY for the decorative element nudges (lerp toward target ≈ a critically-damped
 *    spring) and the MorphGrid bloom (driven via `activityRef`).
 *  - `prefers-reduced-motion`: nudges snap to 0 (no spring), no morph (activity forced to 0),
 *    arrows still render statically at the measurement. Subscribes to the mediaquery `change`.
 */

/** Cursor proximity radius (artboard px) within which a measurement lights up. */
const RADIUS = 150
/** Transient separation amount (artboard px) applied to nudged elements at full strength. */
const DELTA = 26
/** Calm, not chaotic: never more than this many hover measurements (arrows) at once. */
const MAX_COUNT = 4
/** Skip margins larger than this (artboard px): a far-from-border word's huge margin arrow
 * would span most of the page — overwhelming, not informative. Only tight breathing-room
 * margins surface; the big negative space belongs to the MorphGrid bloom. */
const MAX_MARGIN = 240
/** Per-frame lerp for the element-nudge springs (snappy; settles ~8 frames). */
const LERP = 0.22
/** Arrow fade in/out (opacity only). emil's easeOutQuint for a soft, expensive settle. */
const FADE = 'opacity 150ms cubic-bezier(0.23,1,0.32,1)'

/** Fixed pool size — gap + margin arrows during hover, border + neighbor + guide during drag. */
const POOL = 9

/** Snap when a dragged edge/center comes within this many artboard px of a target line. */
const SNAP = 6
/** Key vertical artboard lines: left margin, right margin, horizontal center. */
const KEY_X = [23, 735, ARTBOARD.w / 2]
/** Key horizontal artboard lines: vertical center. */
const KEY_Y = [ARTBOARD.h / 2]
/** How many nearest neighbors to draw gap arrows toward while dragging. */
const NEIGHBORS = 2

/** Cursor velocity (artboard px/frame) that maps to full activity; below decays to rest. */
const ACTIVITY_VEL = 14
/** Per-frame decay of the activity ref toward its velocity/presence target (idle easing). */
const ACTIVITY_DECAY = 0.08

const NS = 'http://www.w3.org/2000/svg'
const HEAD = 5
const TICK = 4

interface Props {
  stage: Stage
  stageRef: React.RefObject<HTMLDivElement>
  placement: PlacementMap
  setPlacement: React.Dispatch<React.SetStateAction<PlacementMap>>
  /** 0..1 interaction intensity the MorphGrid reads (driven here from velocity/presence). */
  activityRef: React.MutableRefObject<number>
  /** Live artboard-space cursor (or null off-stage) the MorphGrid spotlight reads. */
  cursorRef: React.MutableRefObject<{ x: number; y: number } | null>
}

/** A pooled SVG arrow/guide element with handles to its mutable nodes (built once, mutated each frame). */
interface PoolSlot {
  root: HTMLDivElement // positioned wrapper (transform set each frame, no transition)
  svg: SVGSVGElement
  // dimension-arrow primitives
  line: SVGLineElement
  head1: SVGPolylineElement
  head2: SVGPolylineElement
  text: SVGTextElement
  // guide primitives (dashed full-span line + 2 end ticks)
  guide: SVGLineElement
  tickA: SVGLineElement
  tickB: SVGLineElement
  // correction ≠ mark (two short parallel ticks)
  corrA: SVGLineElement
  corrB: SVGLineElement
}

/** A single drawing instruction the loop assigns to a pool slot. */
type Draw =
  | { kind: 'arrow'; orientation: 'h' | 'v'; x: number; y: number; length: number; label: string; opacity: number }
  | { kind: 'guide'; orientation: 'h' | 'v'; pos: number; opacity: number }
  | { kind: 'correction'; x: number; y: number; orientation: 'h' | 'v'; opacity: number }

export function InteractionLayer({ stage, stageRef, placement, setPlacement, activityRef, cursorRef }: Props) {
  const poolWrapRef = useRef<HTMLDivElement>(null)

  // --- live refs (no React state in the hot path) ---
  const stageR = useRef(stage)
  stageR.current = stage
  const placementR = useRef(placement)
  placementR.current = placement

  const pointer = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })
  const prevPointer = useRef<{ x: number; y: number } | null>(null)
  const boxes = useRef<Box[]>([])
  const applied = useRef<Map<string, { dx: number; dy: number }>>(new Map())
  /** Lerped transient nudge per id (springs toward target each frame). */
  const nudge = useRef<Map<string, { dx: number; dy: number }>>(new Map())
  const reduced = useRef(false)
  const pool = useRef<PoolSlot[]>([])

  interface DragState {
    id: string
    origin: Box // resting box at drag start (real on-screen artboard space)
    basePlace: { dx: number; dy: number }
    startPt: { x: number; y: number }
    others: Box[]
    dx: number
    dy: number
    guides: { axis: 'v' | 'h'; pos: number }[]
    moved: boolean
  }
  const drag = useRef<DragState | null>(null)

  // --- build the arrow pool once (refs into raw SVG so the loop never re-renders React) ---
  useEffect(() => {
    const wrap = poolWrapRef.current
    if (!wrap) return
    const slots: PoolSlot[] = []
    for (let i = 0; i < POOL; i++) {
      const root = document.createElement('div')
      root.style.position = 'absolute'
      root.style.left = '0'
      root.style.top = '0'
      root.style.opacity = '0'
      root.style.transition = FADE
      root.style.willChange = 'transform, opacity'
      root.style.pointerEvents = 'none'

      const svg = document.createElementNS(NS, 'svg')
      svg.style.overflow = 'visible'
      svg.style.display = 'block'
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')

      const c = HERO_COLORS.cream
      const mk = <T extends SVGElement>(tag: string): T => document.createElementNS(NS, tag) as unknown as T

      const line = mk<SVGLineElement>('line')
      line.setAttribute('stroke', c)
      line.setAttribute('stroke-width', '1.5')
      const head1 = mk<SVGPolylineElement>('polyline')
      const head2 = mk<SVGPolylineElement>('polyline')
      for (const h of [head1, head2]) {
        h.setAttribute('fill', 'none')
        h.setAttribute('stroke', c)
        h.setAttribute('stroke-width', '1.5')
      }
      const text = mk<SVGTextElement>('text')
      text.setAttribute('font-family', 'var(--font-mono)')
      text.setAttribute('font-size', '11')
      text.setAttribute('fill', c)

      // guide line (dashed full-span) + 2 end ticks
      const guide = mk<SVGLineElement>('line')
      guide.setAttribute('stroke', c)
      guide.setAttribute('stroke-width', '1')
      guide.setAttribute('stroke-dasharray', '3 3')
      const tickA = mk<SVGLineElement>('line')
      const tickB = mk<SVGLineElement>('line')
      for (const t of [tickA, tickB]) {
        t.setAttribute('stroke', c)
        t.setAttribute('stroke-width', '1')
      }

      // ≠ correction mark: two short parallel ticks at a corrected element's edge
      const corrA = mk<SVGLineElement>('line')
      const corrB = mk<SVGLineElement>('line')
      for (const m of [corrA, corrB]) {
        m.setAttribute('stroke', c)
        m.setAttribute('stroke-width', '1.5')
      }

      svg.append(line, head1, head2, text, guide, tickA, tickB, corrA, corrB)
      root.appendChild(svg)
      wrap.appendChild(root)
      slots.push({ root, svg, line, head1, head2, text, guide, tickA, tickB, corrA, corrB })
    }
    pool.current = slots
    return () => {
      for (const s of slots) s.root.remove()
      pool.current = []
    }
  }, [])

  // --- reduced-motion subscription ---
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // --- remeasure: cache resting boxes (mount + ResizeObserver + after placement change) ---
  useEffect(() => {
    const root = stageRef.current
    if (!root) return
    const remeasure = () => {
      const r = stageRef.current
      if (!r) return
      boxes.current = measureBoxes(r, stageR.current, applied.current)
    }
    remeasure()
    const ro = new ResizeObserver(remeasure)
    ro.observe(root)
    return () => ro.disconnect()
    // remeasure when stage scale or committed placement changes (NOT per frame).
  }, [stageRef, stage, placement])

  // --- pointer + drag listeners (write refs only; setPlacement only on commit) ---
  useEffect(() => {
    const root = stageRef.current
    if (!root) return

    const onMove = (e: PointerEvent) => {
      const p = clientToStage(e.clientX, e.clientY, stageR.current)
      pointer.current.x = p.x
      pointer.current.y = p.y
      pointer.current.active = true
      const d = drag.current
      if (d) {
        let dx = p.x - d.startPt.x
        let dy = p.y - d.startPt.y
        const lx = d.origin.x + dx
        const ly = d.origin.y + dy
        const w = d.origin.w
        const h = d.origin.h

        const xTargets = [...KEY_X]
        const yTargets = [...KEY_Y]
        for (const o of d.others) {
          xTargets.push(o.x, o.x + o.w / 2, o.x + o.w)
          yTargets.push(o.y, o.y + o.h / 2, o.y + o.h)
        }
        const guides: { axis: 'v' | 'h'; pos: number }[] = []

        const xEdges = [lx, lx + w / 2, lx + w]
        let bestX: { adjust: number; line: number } | null = null
        for (const edge of xEdges) {
          for (const t of xTargets) {
            const diff = t - edge
            if (Math.abs(diff) <= SNAP && (!bestX || Math.abs(diff) < Math.abs(bestX.adjust))) {
              bestX = { adjust: diff, line: t }
            }
          }
        }
        if (bestX) {
          dx += bestX.adjust
          guides.push({ axis: 'v', pos: bestX.line })
        }

        const yEdges = [ly, ly + h / 2, ly + h]
        let bestY: { adjust: number; line: number } | null = null
        for (const edge of yEdges) {
          for (const t of yTargets) {
            const diff = t - edge
            if (Math.abs(diff) <= SNAP && (!bestY || Math.abs(diff) < Math.abs(bestY.adjust))) {
              bestY = { adjust: diff, line: t }
            }
          }
        }
        if (bestY) {
          dy += bestY.adjust
          guides.push({ axis: 'h', pos: bestY.line })
        }

        d.dx = dx
        d.dy = dy
        d.guides = guides
        if (dx !== 0 || dy !== 0) d.moved = true
      }
    }

    const onLeave = () => {
      pointer.current.active = false
      prevPointer.current = null
    }

    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-word],[data-block]')
      if (!target) return
      const id = target.dataset.word ?? target.dataset.block
      if (!id) return
      e.preventDefault()
      const r = stageRef.current
      if (!r) return
      // Measure ACTUAL placed positions (empty offset map -> nothing subtracted): origin and
      // others sit in real on-screen artboard space, the space the drag delta/snap reason in.
      const live = measureBoxes(r, stageR.current, new Map())
      const origin = live.find((b) => b.id === id)
      if (!origin) return
      const others = live.filter((b) => b.id !== id && (b.kind === 'word' || b.kind === 'block'))
      const startPt = clientToStage(e.clientX, e.clientY, stageR.current)
      const basePlace = placementR.current[id] ?? { dx: 0, dy: 0 }
      drag.current = { id, origin, basePlace, startPt, others, dx: 0, dy: 0, guides: [], moved: false }
    }

    const onUp = () => {
      const d = drag.current
      if (!d) return
      const wasPlaced = d.id in placementR.current
      if (d.moved || wasPlaced) {
        setPlacement((prev) => ({
          ...prev,
          [d.id]: { dx: d.basePlace.dx + d.dx, dy: d.basePlace.dy + d.dy },
        }))
      }
      drag.current = null
      // boxes re-cache happens via the placement-change effect (remeasure).
    }

    root.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      root.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [stageRef, setPlacement])

  // --- the single rAF loop: drives nudges, arrows, activity, cursorRef ---
  useEffect(() => {
    let raf = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const slots = pool.current
      const draws: Draw[] = []

      const p = pointer.current
      const d = drag.current
      const place = placementR.current

      // --- activity (from cursor velocity + presence) -> activityRef for MorphGrid ---
      let velTarget = 0
      if (p.active) {
        const prev = prevPointer.current
        if (prev) {
          const v = Math.hypot(p.x - prev.x, p.y - prev.y)
          velTarget = Math.min(1, 0.25 + v / ACTIVITY_VEL)
        } else {
          velTarget = 0.25
        }
        prevPointer.current = { x: p.x, y: p.y }
        cursorRef.current = { x: p.x, y: p.y }
      } else {
        prevPointer.current = null
        cursorRef.current = null
      }
      if (d) velTarget = Math.max(velTarget, 0.6) // dragging keeps the field alive
      if (reduced.current) {
        activityRef.current = 0
      } else {
        activityRef.current += (velTarget - activityRef.current) * ACTIVITY_DECAY
      }

      // --- compute target nudges (hover only; drag pins the dragged element, no nudges) ---
      let targetNudge = new Map<string, { dx: number; dy: number }>()
      let corrected: string[] = []

      if (d) {
        // ----- DRAG: build border + neighbor + guide annotations -----
        const live: Box = { ...d.origin, x: d.origin.x + d.dx, y: d.origin.y + d.dy }
        const left = live.x
        const right = live.x + live.w
        const top = live.y
        const bottom = live.y + live.h
        const cx = live.x + live.w / 2
        const cy = live.y + live.h / 2

        // four border arrows (left/right horizontal, top/bottom vertical)
        const border: { o: 'h' | 'v'; len: number; x: number; y: number; val: number }[] = [
          { o: 'h', len: left, x: 0, y: cy, val: left },
          { o: 'h', len: ARTBOARD.w - right, x: right, y: cy, val: ARTBOARD.w - right },
          { o: 'v', len: top, x: cx, y: 0, val: top },
          { o: 'v', len: ARTBOARD.h - bottom, x: cx, y: bottom, val: ARTBOARD.h - bottom },
        ]
        for (const b of border) {
          if (b.len > 0.5) {
            draws.push({ kind: 'arrow', orientation: b.o, x: b.x, y: b.y, length: b.len, label: String(Math.round(b.val)), opacity: 1 })
          }
        }

        // nearest-neighbor gap arrows
        const neighbors = [...d.others]
          .map((o) => ({ o, dist: Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) }))
          .sort((a, z) => a.dist - z.dist)
          .slice(0, NEIGHBORS)
        for (const { o } of neighbors) {
          const g = gapArrow(live, o)
          if (g) draws.push({ kind: 'arrow', orientation: g.orientation, x: g.left, y: g.top, length: g.length, label: String(Math.round(g.gap)), opacity: 1 })
        }

        // full-span alignment guides on active snap lines
        for (const gd of d.guides) {
          draws.push({ kind: 'guide', orientation: gd.axis, pos: gd.pos, opacity: 0.9 })
        }
      } else if (p.active) {
        // ----- HOVER: ranked measurements + cursor-tracked arrows -----
        const cur = { x: p.x, y: p.y }
        const candidates = buildMeasurements(boxes.current, ARTBOARD).filter(
          (m) => m.type !== 'margin' || m.dist <= MAX_MARGIN,
        )
        const sel = selectMeasurements(candidates, cur, { maxCount: MAX_COUNT, radius: RADIUS })

        if (!reduced.current) {
          // Separate ONLY the primary (nearest) measurement's elements — the thing directly
          // under the cursor. The other arrows still read as measurements, but their elements
          // stay put. With the hero's tight -10% tracking, nudging every selected element would
          // make neighbours constantly collide (a mess of correction ticks); focusing the nudge
          // keeps it calm and the auto-correction annotation rare + meaningful.
          const raw = elementOffsets(sel.slice(0, 1), DELTA)
          const res = preventOverlap(boxes.current, raw)
          targetNudge = res.offsets
          corrected = res.corrected
        }

        // word rects (resting + clamped nudge) for arrow/word collision checks
        const wordRects: Rect[] = boxes.current.map((b) => {
          const n = targetNudge.get(b.id) ?? { dx: 0, dy: 0 }
          return { x: b.x + n.dx, y: b.y + n.dy, w: b.w, h: b.h }
        })

        // Build a draw per selected measurement; track label rects for de-collision.
        interface Pending {
          draw: Extract<Draw, { kind: 'arrow' }>
          labelRect: Rect
        }
        const pending: Pending[] = []

        for (const s of sel) {
          const { m, strength } = s
          const opacity = Math.max(0.2, strength)
          const track = cursorRelevance(m, cur, RADIUS).track

          let arrow: Extract<Draw, { kind: 'arrow' }> | null = null
          if (m.type === 'gap') {
            const opened = Math.max(0, m.gap + DELTA * strength)
            if (opened >= 3) {
              if (m.axis === 'v') {
                const mid = (m.span.x1 + m.span.x2) / 2
                arrow = { kind: 'arrow', orientation: 'h', x: mid - opened / 2, y: track.y, length: opened, label: String(Math.round(opened)), opacity }
              } else {
                const mid = (m.span.y1 + m.span.y2) / 2
                arrow = { kind: 'arrow', orientation: 'v', x: track.x, y: mid - opened / 2, length: opened, label: String(Math.round(opened)), opacity }
              }
            }
          } else if (m.side === 'left' || m.side === 'right') {
            const len = Math.abs(m.span.x2 - m.span.x1)
            arrow = { kind: 'arrow', orientation: 'h', x: Math.min(m.span.x1, m.span.x2), y: track.y, length: len, label: String(Math.round(m.dist)), opacity }
          } else {
            const len = Math.abs(m.span.y2 - m.span.y1)
            arrow = { kind: 'arrow', orientation: 'v', x: track.x, y: Math.min(m.span.y1, m.span.y2), length: len, label: String(Math.round(m.dist)), opacity }
          }
          if (!arrow) continue

          // Nudge the arrow perpendicular off any word it would cross (its body rect).
          const bodyRect = arrowBodyRect(arrow)
          if (crossesAny(bodyRect, wordRects)) {
            const shifted = nudgeOffWords(arrow, wordRects)
            arrow.x = shifted.x
            arrow.y = shifted.y
          }

          pending.push({ draw: arrow, labelRect: labelRect(arrow) })
        }

        // numbers never overlap: push label rects apart, shift each arrow's draw point by dy.
        const dys = resolveLabelCollisions(pending.map((q) => q.labelRect))
        pending.forEach((q, i) => {
          q.draw.y += dys[i]
          draws.push(q.draw)
        })

        // ≠ marks at corrected elements' touching edge (small double-tick).
        for (const id of corrected) {
          const b = boxes.current.find((bb) => bb.id === id)
          if (!b) continue
          const n = targetNudge.get(id) ?? { dx: 0, dy: 0 }
          const ex = b.x + n.dx + b.w / 2
          const ey = b.y + n.dy + b.h / 2
          draws.push({ kind: 'correction', x: ex, y: ey, orientation: 'v', opacity: 0.85 })
        }
      }

      // --- spring the element nudges toward target, write transforms imperatively ---
      const root = stageRef.current
      if (root) {
        const els = queryReactiveEls(root)
        const all: { el: HTMLElement; id: string }[] = [
          ...els.letters.map((el) => ({ el, id: el.dataset.letter! })),
          ...els.words.map((el) => ({ el, id: el.dataset.word! })),
          ...els.blocks.map((el) => ({ el, id: el.dataset.block! })),
        ]
        for (const { el, id } of all) {
          const isDragged = d && d.id === id
          const target = targetNudge.get(id) ?? { dx: 0, dy: 0 }
          const cur = nudge.current.get(id) ?? { dx: 0, dy: 0 }
          if (reduced.current) {
            cur.dx = 0
            cur.dy = 0
          } else {
            cur.dx += (target.dx - cur.dx) * LERP
            cur.dy += (target.dy - cur.dy) * LERP
            if (Math.abs(cur.dx) < 0.01 && target.dx === 0) cur.dx = 0
            if (Math.abs(cur.dy) < 0.01 && target.dy === 0) cur.dy = 0
          }
          nudge.current.set(id, cur)

          const pl = place[id] ?? { dx: 0, dy: 0 }
          let tx: number
          let ty: number
          if (isDragged) {
            // pin the dragged element to its live position, no spring, no nudge
            tx = d!.basePlace.dx + d!.dx
            ty = d!.basePlace.dy + d!.dy
          } else {
            tx = pl.dx + cur.dx
            ty = pl.dy + cur.dy
          }
          // transform only, NO transition (the spring IS the easing). Skip the DOM write when
          // nothing moved this frame (idle elements) to avoid needless style invalidation —
          // keeps the loop buttery when at rest. applied cache feeds the next remeasure.
          const prevApplied = applied.current.get(id)
          if (!prevApplied || prevApplied.dx !== tx || prevApplied.dy !== ty) {
            el.style.transition = 'none'
            el.style.transform = tx || ty ? `translate(${tx}px, ${ty}px)` : ''
            applied.current.set(id, { dx: tx, dy: ty })
          }
        }
      }

      // --- write the arrow pool (transform set each frame, opacity fades) ---
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        const dr = draws[i]
        if (!dr) {
          slot.root.style.opacity = '0'
          continue
        }
        paintSlot(slot, dr)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stageRef, activityRef, cursorRef])

  return (
    <div ref={poolWrapRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
  )
}

/** Approximate the arrow's body rect (the line span) for word-collision checks. */
function arrowBodyRect(a: Extract<Draw, { kind: 'arrow' }>): Rect {
  if (a.orientation === 'h') return { x: a.x, y: a.y - 1, w: a.length, h: 16 }
  return { x: a.x - 1, y: a.y, w: 16, h: a.length }
}

/** The arrow's label rect (mono 11px centered), used for de-overlapping numbers. */
function labelRect(a: Extract<Draw, { kind: 'arrow' }>): Rect {
  const tw = Math.max(12, a.label.length * 7 + 4)
  const th = 13
  if (a.orientation === 'h') return { x: a.x + a.length / 2 - tw / 2, y: a.y - 12, w: tw, h: th }
  return { x: a.x + 12, y: a.y + a.length / 2 - th / 2, w: tw, h: th }
}

/** Shift an arrow perpendicular to its axis until its body clears every word (bounded). */
function nudgeOffWords(a: Extract<Draw, { kind: 'arrow' }>, words: Rect[]): { x: number; y: number } {
  let { x, y } = a
  const STEP = 4
  for (let i = 0; i < 24; i++) {
    const body = a.orientation === 'h' ? { x, y: y - 1, w: a.length, h: 16 } : { x: x - 1, y, w: 16, h: a.length }
    if (!crossesAny(body, words)) break
    // push perpendicular (h arrow -> move in y; v arrow -> move in x), alternating sign+
    if (a.orientation === 'h') y += STEP
    else x += STEP
  }
  return { x, y }
}

/** Write a Draw instruction into a pooled SVG slot (transform/attributes only). */
function paintSlot(slot: PoolSlot, dr: Draw) {
  const show = (el: SVGElement, on: boolean) => {
    el.style.display = on ? '' : 'none'
  }
  // hide everything; the active branch re-enables its primitives
  show(slot.line, false)
  show(slot.head1, false)
  show(slot.head2, false)
  show(slot.text, false)
  show(slot.guide, false)
  show(slot.tickA, false)
  show(slot.tickB, false)
  show(slot.corrA, false)
  show(slot.corrB, false)

  slot.root.style.opacity = String(dr.opacity)

  if (dr.kind === 'arrow') {
    const L = dr.length
    if (dr.orientation === 'h') {
      slot.svg.setAttribute('width', String(L))
      slot.svg.setAttribute('height', '16')
      setLine(slot.line, 0, 8, L, 8)
      slot.head1.setAttribute('points', `${HEAD},${8 - HEAD} 0,8 ${HEAD},${8 + HEAD}`)
      slot.head2.setAttribute('points', `${L - HEAD},${8 - HEAD} ${L},8 ${L - HEAD},${8 + HEAD}`)
      setText(slot.text, L / 2, 4, 'middle', dr.label)
    } else {
      slot.svg.setAttribute('width', '16')
      slot.svg.setAttribute('height', String(L))
      setLine(slot.line, 8, 0, 8, L)
      slot.head1.setAttribute('points', `${8 - HEAD},${HEAD} 8,0 ${8 + HEAD},${HEAD}`)
      slot.head2.setAttribute('points', `${8 - HEAD},${L - HEAD} 8,${L} ${8 + HEAD},${L - HEAD}`)
      setText(slot.text, 12, L / 2, 'start', dr.label)
    }
    slot.root.style.transform = `translate(${dr.x}px, ${dr.y}px)`
    show(slot.line, true)
    show(slot.head1, true)
    show(slot.head2, true)
    show(slot.text, true)
    return
  }

  if (dr.kind === 'guide') {
    if (dr.orientation === 'v') {
      const span = ARTBOARD.h
      slot.svg.setAttribute('width', '16')
      slot.svg.setAttribute('height', String(span))
      setLine(slot.guide, 8, 0, 8, span)
      setLine(slot.tickA, 8 - TICK, 0, 8 + TICK, 0)
      setLine(slot.tickB, 8 - TICK, span, 8 + TICK, span)
      slot.root.style.transform = `translate(${dr.pos - 8}px, 0px)`
    } else {
      const span = ARTBOARD.w
      slot.svg.setAttribute('width', String(span))
      slot.svg.setAttribute('height', '16')
      setLine(slot.guide, 0, 8, span, 8)
      setLine(slot.tickA, 0, 8 - TICK, 0, 8 + TICK)
      setLine(slot.tickB, span, 8 - TICK, span, 8 + TICK)
      slot.root.style.transform = `translate(0px, ${dr.pos - 8}px)`
    }
    show(slot.guide, true)
    show(slot.tickA, true)
    show(slot.tickB, true)
    return
  }

  // correction ≠ mark: two short parallel ticks crossing the touching edge
  slot.svg.setAttribute('width', '12')
  slot.svg.setAttribute('height', '12')
  setLine(slot.corrA, 1, 3, 11, 1)
  setLine(slot.corrB, 1, 11, 11, 9)
  slot.root.style.transform = `translate(${dr.x - 6}px, ${dr.y - 6}px)`
  show(slot.corrA, true)
  show(slot.corrB, true)
}

function setLine(el: SVGLineElement, x1: number, y1: number, x2: number, y2: number) {
  el.setAttribute('x1', String(x1))
  el.setAttribute('y1', String(y1))
  el.setAttribute('x2', String(x2))
  el.setAttribute('y2', String(y2))
}

function setText(el: SVGTextElement, x: number, y: number, anchor: string, label: string) {
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('text-anchor', anchor)
  el.textContent = label
}

interface GapArrow {
  orientation: 'h' | 'v'
  left: number
  top: number
  length: number
  gap: number
}

/** A gap arrow from dragged box `a` to neighbor `b`, along whichever axis they're cleanly
 * separated on (prefer the axis with a real, non-overlapping gap). Mirrors DragLayer. */
function gapArrow(a: Box, b: Box): GapArrow | null {
  const aL = a.x
  const aR = a.x + a.w
  const aT = a.y
  const aB = a.y + a.h
  const bL = b.x
  const bR = b.x + b.w
  const bT = b.y
  const bB = b.y + b.h

  const yOverlap = Math.min(aB, bB) - Math.max(aT, bT)
  if (yOverlap > 0) {
    if (bL >= aR) {
      const yMid = (Math.max(aT, bT) + Math.min(aB, bB)) / 2
      return { orientation: 'h', left: aR, top: yMid, length: bL - aR, gap: bL - aR }
    }
    if (aL >= bR) {
      const yMid = (Math.max(aT, bT) + Math.min(aB, bB)) / 2
      return { orientation: 'h', left: bR, top: yMid, length: aL - bR, gap: aL - bR }
    }
  }

  const xOverlap = Math.min(aR, bR) - Math.max(aL, bL)
  if (xOverlap > 0) {
    if (bT >= aB) {
      const xMid = (Math.max(aL, bL) + Math.min(aR, bR)) / 2
      return { orientation: 'v', left: xMid, top: aB, length: bT - aB, gap: bT - aB }
    }
    if (aT >= bB) {
      const xMid = (Math.max(aL, bL) + Math.min(aR, bR)) / 2
      return { orientation: 'v', left: xMid, top: bB, length: aT - bB, gap: aT - bB }
    }
  }

  return null
}
