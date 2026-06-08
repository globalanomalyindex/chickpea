import { useEffect, useRef, useState } from 'react'
import { clientToStage, type Stage } from './stageScale'
import { ARTBOARD, HERO_COLORS } from './heroLayout'
import type { Box } from './measurements'
import { DimensionArrow, GuideLine } from '../components/DimensionArrow'
import {
  measureBoxes,
  queryReactiveEls,
  applyTransform,
  type PlacementMap,
} from './heroDom'

/** Snap when a dragged edge/center comes within this many artboard px of a target line. */
const SNAP = 6
/** Key vertical artboard lines: left margin, right margin, horizontal center. */
const KEY_X = [23, 735, ARTBOARD.w / 2]
/** Key horizontal artboard lines: vertical center. */
const KEY_Y = [ARTBOARD.h / 2]
/** How many nearest neighbors to draw gap arrows toward while dragging. */
const NEIGHBORS = 2

interface Props {
  stage: Stage
  stageRef: React.RefObject<HTMLDivElement>
  placement: PlacementMap
  setPlacement: React.Dispatch<React.SetStateAction<PlacementMap>>
}

interface Guide {
  axis: 'v' | 'h'
  pos: number
}

interface DragState {
  id: string
  /** the element's resting (placed) box at drag start, in artboard px. */
  origin: Box
  /** the dragged element's placement at drag start. */
  basePlace: { dx: number; dy: number }
  /** pointer position at drag start, in artboard px. */
  startPt: { x: number; y: number }
  /** the live box after applying the (snapped) delta. */
  live: Box
  /** the snapped delta from origin, in artboard px. */
  dx: number
  dy: number
  /** other elements' resting boxes (for neighbor gaps + snap targets). */
  others: Box[]
  guides: Guide[]
}

export function DragLayer({ stage, stageRef, placement, setPlacement }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag
  /** Currently-applied translate per element id (placement + live drag). */
  const applied = useRef<Map<string, { dx: number; dy: number }>>(new Map())
  const placementRef = useRef<PlacementMap>(placement)
  placementRef.current = placement

  // Apply placement transforms to all reactive elements (so placed items stay put). The
  // actively-dragged element is pinned instantly to its live position; everything else
  // springs with the fast curve.
  useEffect(() => {
    const root = stageRef.current
    if (!root) return
    const els = queryReactiveEls(root)
    const all: { el: HTMLElement; id: string }[] = [
      ...els.letters.map((el) => ({ el, id: el.dataset.letter! })),
      ...els.words.map((el) => ({ el, id: el.dataset.word! })),
      ...els.blocks.map((el) => ({ el, id: el.dataset.block! })),
    ]
    const d = drag
    for (const { el, id } of all) {
      const place = placement[id] ?? { dx: 0, dy: 0 }
      if (d && d.id === id) {
        applyTransform(el, id, d.basePlace.dx + d.dx, d.basePlace.dy + d.dy, applied.current, true)
      } else {
        applyTransform(el, id, place.dx, place.dy, applied.current)
      }
    }
  }, [placement, drag, stageRef])

  // Begin a drag on pointerdown over a word or block.
  useEffect(() => {
    const root = stageRef.current
    if (!root) return

    function onDown(e: PointerEvent) {
      const r = stageRef.current
      if (!r) return
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-word],[data-block]')
      if (!target) return
      const id = target.dataset.word ?? target.dataset.block
      if (!id) return
      e.preventDefault()

      // Measure ACTUAL rendered (placement-applied) positions: pass an empty offset map so
      // nothing is subtracted. The dragged element sits at its placed spot at drag start, so
      // `origin` and `others` are all in real, on-screen artboard space — the space the drag
      // delta, neighbor gaps, and snap guides all reason in.
      const boxes = measureBoxes(r, stage, new Map())
      const origin = boxes.find((b) => b.id === id)
      if (!origin) return
      const others = boxes.filter((b) => b.id !== id && (b.kind === 'word' || b.kind === 'block'))
      const startPt = clientToStage(e.clientX, e.clientY, stage)
      const basePlace = placementRef.current[id] ?? { dx: 0, dy: 0 }

      setDrag({
        id,
        origin,
        basePlace,
        startPt,
        live: origin,
        dx: 0,
        dy: 0,
        others,
        guides: [],
      })
    }

    function onUp() {
      const d = dragRef.current
      if (!d) return
      // Commit the snapped position into the placement map; the element stays. A pure click
      // with no movement on an as-yet-unplaced element leaves the placement map untouched
      // (so the reset control doesn't appear for an accidental tap).
      const moved = d.dx !== 0 || d.dy !== 0
      const wasPlaced = d.id in placementRef.current
      if (moved || wasPlaced) {
        setPlacement((prev) => ({
          ...prev,
          [d.id]: { dx: d.basePlace.dx + d.dx, dy: d.basePlace.dy + d.dy },
        }))
      }
      setDrag(null)
    }

    let raf = 0
    function onMove(e: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const cur = dragRef.current
        if (!cur) return
        const p = clientToStage(e.clientX, e.clientY, stage)
        let dx = p.x - cur.startPt.x
        let dy = p.y - cur.startPt.y

        // raw live box (before snap)
        const lx = cur.origin.x + dx
        const ly = cur.origin.y + dy
        const w = cur.origin.w
        const h = cur.origin.h

        // Candidate target lines along each axis: key artboard lines + neighbor edges/centers.
        const xTargets = [...KEY_X]
        const yTargets = [...KEY_Y]
        for (const o of cur.others) {
          xTargets.push(o.x, o.x + o.w / 2, o.x + o.w)
          yTargets.push(o.y, o.y + o.h / 2, o.y + o.h)
        }

        const guides: Guide[] = []

        // x snap: try left, center, right edges of the dragged box.
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

        // y snap: try top, middle, bottom edges.
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

        const live: Box = { ...cur.origin, x: cur.origin.x + dx, y: cur.origin.y + dy }
        setDrag({ ...cur, dx, dy, live, guides })
      })
    }

    root.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      root.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cancelAnimationFrame(raf)
    }
  }, [stage, stageRef, setPlacement])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', cursor: drag ? 'grabbing' : 'default' }}>
      {drag && <DragAnnotations drag={drag} />}
    </div>
  )
}

/** Live Figma-style annotations around the dragged element: four border arrows, the 1–2
 * nearest neighbor-gap arrows, and full-span alignment guides on every active snap line. */
function DragAnnotations({ drag }: { drag: DragState }) {
  const c = HERO_COLORS.cream
  const b = drag.live
  const left = b.x
  const right = b.x + b.w
  const top = b.y
  const bottom = b.y + b.h
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2

  // four border arrows: left/right (horizontal), top/bottom (vertical)
  const border = [
    { o: 'h' as const, len: left, x: 0, y: cy, val: left },
    { o: 'h' as const, len: ARTBOARD.w - right, x: right, y: cy, val: ARTBOARD.w - right },
    { o: 'v' as const, len: top, x: cx, y: 0, val: top },
    { o: 'v' as const, len: ARTBOARD.h - bottom, x: cx, y: bottom, val: ARTBOARD.h - bottom },
  ]

  // nearest neighbors: pick the NEIGHBORS closest by center distance, draw a clean gap arrow
  // along whichever axis they're separated on.
  const neighbors = [...drag.others]
    .map((o) => ({ o, d: Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) }))
    .sort((a, z) => a.d - z.d)
    .slice(0, NEIGHBORS)
    .map(({ o }) => gapArrow(b, o))
    .filter((g): g is GapArrow => g !== null)

  return (
    <>
      {border.map((a, i) =>
        a.len > 0.5 ? (
          <div key={`b${i}`} style={{ position: 'absolute', left: a.x, top: a.y }}>
            <DimensionArrow orientation={a.o} length={a.len} label={String(Math.round(a.val))} color={c} />
          </div>
        ) : null,
      )}

      {neighbors.map((g, i) => (
        <div key={`n${i}`} style={{ position: 'absolute', left: g.left, top: g.top }}>
          <DimensionArrow orientation={g.orientation} length={g.length} label={String(Math.round(g.gap))} color={c} />
        </div>
      ))}

      {drag.guides.map((gd, i) =>
        gd.axis === 'v' ? (
          <GuideLine key={`g${i}`} orientation="v" pos={gd.pos} span={ARTBOARD.h} color={c} />
        ) : (
          <GuideLine key={`g${i}`} orientation="h" pos={gd.pos} span={ARTBOARD.w} color={c} />
        ),
      )}
    </>
  )
}

interface GapArrow {
  orientation: 'h' | 'v'
  left: number
  top: number
  length: number
  gap: number
}

/** A gap arrow from the dragged box `a` to neighbor `b`, along whichever axis they're
 * cleanly separated on (prefer the axis with a real, non-overlapping gap). */
function gapArrow(a: Box, b: Box): GapArrow | null {
  const aL = a.x
  const aR = a.x + a.w
  const aT = a.y
  const aB = a.y + a.h
  const bL = b.x
  const bR = b.x + b.w
  const bT = b.y
  const bB = b.y + b.h

  // horizontal gap (b to the right or left of a), only if their y-extents overlap
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

  // vertical gap (b below or above a), only if their x-extents overlap
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
