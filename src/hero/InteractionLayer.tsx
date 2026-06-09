import { useEffect, useRef } from 'react'
import { clientToStage, type Stage } from './stageScale'
import { buildMeasurements, selectMeasurements, cursorRelevance, type Box } from './measurements'
import { relax, restOverlapPairs, layoutLabels, crossesAny, type Rect, type SolverBox } from './collision'
import { ARTBOARD, HERO_COLORS } from './heroLayout'
import { measureBoxes, queryReactiveEls, type PlacementMap } from './heroDom'

/**
 * InteractionLayer — the single, unified, buttery interaction engine for the hero.
 *
 * ONE React mount, ONE imperative `requestAnimationFrame` loop, ZERO React state in the hot path
 * (refs + direct DOM writes), ZERO per-frame layout reads (resting boxes are cached on mount /
 * ResizeObserver / placement change).
 *
 * The whole system is built on ONE global guarantee: **nothing ever overlaps**. A single cascading
 * relaxation solver (`relax`) resolves overlaps among the movable "push-units" (the non-title words
 * + the title as one block); the SAME idea (`layoutLabels`) keeps every number clear of every word,
 * letter, arrowhead and other number. Push always PROPAGATES down the chain.
 *
 * One mode, no toggle:
 *  - HOVER measures: the title separates with a continuous *split-and-spread* (preserving kerning,
 *    no jitter); words/blocks separate + cascade via `relax`; cursor-tracked dimension arrows light
 *    up with numbers that never collide with anything.
 *  - DRAG (pointerdown on a word / the title): the grabbed unit is PINNED to the cursor and every
 *    other unit moves out of its way down the chain; release commits the resolved cascade so the
 *    composition stays overlap-free and keeps evolving.
 *
 * emil law: only `transform`/`opacity` animate; arrows track the cursor 1:1 via `transform` with no
 * transition; springs (a per-frame lerp) only for the decorative element nudges; `prefers-reduced-
 * motion` snaps nudges to 0 and renders arrows statically.
 */

/** Cursor proximity radius (artboard px) within which a measurement lights up. */
const RADIUS = 150
/** Separation amount (artboard px) applied at full strength. */
const DELTA = 24
/** Calm + legible: never annotate more than this many measurements at once. */
const MAX_HOVER = 3
/** Skip margins larger than this (artboard px) — the big negative space belongs to the MorphGrid. */
const MAX_MARGIN = 240
/** Per-frame lerp for the element-nudge springs (snappy; settles ~8 frames). */
const LERP = 0.24
/** Breathing room (artboard px) kept between any two boxes the solver separates. */
const PAD = 4
/** Min nudge magnitude (artboard px) before a bounced element earns a dotted "ghost" mark. */
const GHOST_MIN = 6
/** Arrow / label fade in-out (opacity only). emil's easeOutQuint for a soft, expensive settle. */
const FADE = 'opacity 150ms cubic-bezier(0.23,1,0.32,1)'

/** Generous fixed pool — arrow lines, detached number labels, ghosts and drag guides all draw from it. */
const POOL = 24

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
const CAP = 3

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

interface Props {
  stage: Stage
  stageRef: React.RefObject<HTMLDivElement>
  placement: PlacementMap
  setPlacement: React.Dispatch<React.SetStateAction<PlacementMap>>
  /** 0..1 interaction intensity the MorphGrid reads (driven here from velocity/presence). */
  activityRef: React.MutableRefObject<number>
  /** Live artboard-space cursor (or null off-stage) the MorphGrid spotlight reads. */
  cursorRef: React.MutableRefObject<{ x: number; y: number } | null>
  /** Live placed word/block boxes (artboard px) the MorphGrid anchors its grid to. */
  compositionRef: React.MutableRefObject<Rect[]>
  /** Bumped whenever the composition changes (placement commit / resize). */
  compositionVersion: React.MutableRefObject<number>
}

/** A pooled SVG element with handles to its mutable nodes (built once, mutated each frame). */
interface PoolSlot {
  root: HTMLDivElement
  svg: SVGSVGElement
  line: SVGLineElement
  head1: SVGPolylineElement
  head2: SVGPolylineElement
  text: SVGTextElement
  // dashed line + 2 end ticks: doubles as the drag guide (full-span) and the ghost (short segment)
  guide: SVGLineElement
  tickA: SVGLineElement
  tickB: SVGLineElement
}

/** A drawing instruction the loop assigns to a pool slot. Numbers are DETACHED from arrow lines so
 * they can be relocated freely to avoid every overlap. */
type Draw =
  | { kind: 'arrowline'; orientation: 'h' | 'v'; x: number; y: number; length: number; opacity: number }
  | { kind: 'label'; x: number; y: number; text: string; opacity: number }
  | { kind: 'guide'; orientation: 'h' | 'v'; pos: number; opacity: number }
  | { kind: 'ghost'; x1: number; y1: number; x2: number; y2: number; opacity: number }

interface DragState {
  id: string
  origin: Box // placed box at drag start
  basePlace: { dx: number; dy: number }
  startPt: { x: number; y: number }
  dx: number
  dy: number
  guides: { axis: 'v' | 'h'; pos: number }[]
  moved: boolean
  resolvedOthers: Map<string, { dx: number; dy: number }>
}

export function InteractionLayer({
  stage,
  stageRef,
  placement,
  setPlacement,
  activityRef,
  cursorRef,
  compositionRef,
  compositionVersion,
}: Props) {
  const poolWrapRef = useRef<HTMLDivElement>(null)

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
  const drag = useRef<DragState | null>(null)

  // --- build the pool once (refs into raw SVG so the loop never re-renders React) ---
  useEffect(() => {
    const wrap = poolWrapRef.current
    if (!wrap) return
    const slots: PoolSlot[] = []
    const c = HERO_COLORS.cream
    const mk = <T extends SVGElement>(tag: string): T => document.createElementNS(NS, tag) as unknown as T
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

      const guide = mk<SVGLineElement>('line')
      guide.setAttribute('stroke', c)
      guide.setAttribute('stroke-width', '1')
      const tickA = mk<SVGLineElement>('line')
      const tickB = mk<SVGLineElement>('line')
      for (const t of [tickA, tickB]) {
        t.setAttribute('stroke', c)
        t.setAttribute('stroke-width', '1')
      }

      svg.append(line, head1, head2, text, guide, tickA, tickB)
      root.appendChild(svg)
      wrap.appendChild(root)
      slots.push({ root, svg, line, head1, head2, text, guide, tickA, tickB })
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

  // --- remeasure: cache resting boxes + publish the placed composition (NOT per frame) ---
  useEffect(() => {
    const root = stageRef.current
    if (!root) return
    const remeasure = () => {
      const r = stageRef.current
      if (!r) return
      boxes.current = measureBoxes(r, stageR.current, applied.current)
      const place = placementR.current
      compositionRef.current = boxes.current
        .filter((b) => b.kind === 'word' || b.kind === 'block')
        .map((b) => {
          const pl = place[b.id] ?? { dx: 0, dy: 0 }
          return { x: b.x + pl.dx, y: b.y + pl.dy, w: b.w, h: b.h }
        })
      compositionVersion.current += 1
    }
    remeasure()
    const ro = new ResizeObserver(remeasure)
    ro.observe(root)
    return () => ro.disconnect()
  }, [stageRef, stage, placement, compositionRef, compositionVersion])

  // --- pointer + drag listeners (write refs only; setPlacement only on commit) ---
  useEffect(() => {
    const root = stageRef.current
    if (!root) return

    const onMove = (e: PointerEvent) => {
      const p = clientToStage(e.clientX, e.clientY, stageR.current)
      pointer.current.x = p.x
      pointer.current.y = p.y
      pointer.current.active = true
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
      // origin = placed box (resting + committed placement), from the cache — no layout read.
      const rest = boxes.current.find((b) => b.id === id)
      if (!rest) return
      const place = placementR.current
      const pl = place[id] ?? { dx: 0, dy: 0 }
      const origin: Box = { ...rest, x: rest.x + pl.dx, y: rest.y + pl.dy }
      const startPt = clientToStage(e.clientX, e.clientY, stageR.current)
      drag.current = {
        id,
        origin,
        basePlace: pl,
        startPt,
        dx: 0,
        dy: 0,
        guides: [],
        moved: false,
        resolvedOthers: new Map(),
      }
    }

    const onUp = () => {
      const d = drag.current
      if (!d) return
      const wasPlaced = d.id in placementR.current
      if (d.moved || wasPlaced) {
        // Commit the dragged unit AND the resolved cascade, so the composition stays overlap-free
        // and keeps evolving down new pathways (others don't snap back into the dropped element).
        setPlacement((prev) => {
          const next: PlacementMap = { ...prev }
          next[d.id] = { dx: d.basePlace.dx + d.dx, dy: d.basePlace.dy + d.dy }
          for (const [id, t] of d.resolvedOthers) {
            if (Math.hypot(t.dx, t.dy) < 0.5) continue
            const base = prev[id] ?? { dx: 0, dy: 0 }
            next[id] = { dx: base.dx + t.dx, dy: base.dy + t.dy }
            // zero the transient nudge for committed units so they don't double-apply next frame
            nudge.current.set(id, { dx: 0, dy: 0 })
          }
          return next
        })
      }
      drag.current = null
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

  // --- the single rAF loop ---
  useEffect(() => {
    let raf = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const slots = pool.current
      const draws: Draw[] = []

      const p = pointer.current
      const d = drag.current
      const place = placementR.current
      const rest = boxes.current

      // placed boxes (resting + committed placement) + a by-id index
      const placedById = new Map<string, Box>()
      const placed: Box[] = rest.map((b) => {
        const pl = place[b.id] ?? { dx: 0, dy: 0 }
        const pb = pl.dx || pl.dy ? { ...b, x: b.x + pl.dx, y: b.y + pl.dy } : b
        placedById.set(b.id, pb)
        return pb
      })
      // push-units: the non-title words + the title as ONE block (disjoint at rest)
      const units = placed.filter((b) => b.kind === 'word' || b.id === 'title')

      // --- activity (cursor velocity + presence) -> activityRef for MorphGrid ---
      let velTarget = 0
      if (p.active) {
        const prev = prevPointer.current
        velTarget = prev ? Math.min(1, 0.25 + Math.hypot(p.x - prev.x, p.y - prev.y) / ACTIVITY_VEL) : 0.25
        prevPointer.current = { x: p.x, y: p.y }
        cursorRef.current = { x: p.x, y: p.y }
      } else {
        prevPointer.current = null
        cursorRef.current = null
      }
      if (d) velTarget = Math.max(velTarget, 0.6)
      if (reduced.current) activityRef.current = 0
      else activityRef.current += (velTarget - activityRef.current) * ACTIVITY_DECAY

      // --- target nudges + annotations ---
      const targetNudge = new Map<string, { dx: number; dy: number }>()
      // arrows (with their natural label boxes), filled by drag or hover, de-collided at the end
      const pending: { arrow: Extract<Draw, { kind: 'arrowline' }>; label: { box: Rect; text: string }; opacity: number }[] = []
      const ghosts: { box: Box; t: { dx: number; dy: number } }[] = []

      if (d) {
        // ===== DRAG: pin the grabbed unit at the cursor, relax everyone else out of the way =====
        const w = d.origin.w
        const h = d.origin.h
        let dx = p.x - d.startPt.x
        let dy = p.y - d.startPt.y

        const others = units.filter((u) => u.id !== d.id)

        // snap dragged edges/center to key lines + other unit edges
        const xTargets = [...KEY_X]
        const yTargets = [...KEY_Y]
        for (const o of others) {
          xTargets.push(o.x, o.x + o.w / 2, o.x + o.w)
          yTargets.push(o.y, o.y + o.h / 2, o.y + o.h)
        }
        const guides: { axis: 'v' | 'h'; pos: number }[] = []
        const lx = d.origin.x + dx
        const ly = d.origin.y + dy
        let bestX: { adjust: number; line: number } | null = null
        for (const edge of [lx, lx + w / 2, lx + w]) {
          for (const t of xTargets) {
            const diff = t - edge
            if (Math.abs(diff) <= SNAP && (!bestX || Math.abs(diff) < Math.abs(bestX.adjust))) bestX = { adjust: diff, line: t }
          }
        }
        if (bestX) {
          dx += bestX.adjust
          guides.push({ axis: 'v', pos: bestX.line })
        }
        let bestY: { adjust: number; line: number } | null = null
        for (const edge of [ly, ly + h / 2, ly + h]) {
          for (const t of yTargets) {
            const diff = t - edge
            if (Math.abs(diff) <= SNAP && (!bestY || Math.abs(diff) < Math.abs(bestY.adjust))) bestY = { adjust: diff, line: t }
          }
        }
        if (bestY) {
          dy += bestY.adjust
          guides.push({ axis: 'h', pos: bestY.line })
        }

        // relax: dragged pinned at its (snapped) live position; others mobile from their home.
        // Pairs already overlapping at HOME (dragged at rest + others placed) are preserved, so a
        // coarse box that intersects a neighbor by design never gets spuriously shoved.
        const skip = restOverlapPairs([
          { id: d.id, x: d.origin.x, y: d.origin.y, w, h },
          ...others.map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h })),
        ])
        const solver: SolverBox[] = [
          { id: d.id, x: d.origin.x + dx, y: d.origin.y + dy, w, h, pinned: true },
          ...others.map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, pinned: false })),
        ]
        const resolved = relax(solver, { pad: PAD, skip })
        const resolvedOthers = new Map<string, { dx: number; dy: number }>()
        const movedById = new Map<string, Box>()
        for (const o of others) {
          const r = resolved.get(o.id)!
          const t = { dx: r.x - o.x, dy: r.y - o.y }
          resolvedOthers.set(o.id, t)
          targetNudge.set(o.id, t)
          movedById.set(o.id, { ...o, x: r.x, y: r.y })
          if (Math.hypot(t.dx, t.dy) >= GHOST_MIN) ghosts.push({ box: o, t })
        }
        d.dx = dx
        d.dy = dy
        d.guides = guides
        d.resolvedOthers = resolvedOthers
        if (dx || dy) d.moved = true

        // annotations: four border arrows + nearest-neighbor gaps + snap guides
        const live: Box = { ...d.origin, x: d.origin.x + dx, y: d.origin.y + dy }
        addBorderArrows(pending, live)
        const cx = live.x + live.w / 2
        const cy = live.y + live.h / 2
        const neighbors = [...movedById.values()]
          .map((o) => ({ o, dist: Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) }))
          .sort((a, z) => a.dist - z.dist)
          .slice(0, NEIGHBORS)
        for (const { o } of neighbors) addGapArrow(pending, live, o)
        for (const g of guides) draws.push({ kind: 'guide', orientation: g.axis, pos: g.pos, opacity: 0.9 })
      } else if (p.active && !reduced.current) {
        // ===== HOVER: title split-and-spread (letters) + word/block relax + measurements =====
        const cur = { x: p.x, y: p.y }
        const ms = buildMeasurements(placed, ARTBOARD).filter((m) => m.type !== 'margin' || m.dist <= MAX_MARGIN)
        const sel = selectMeasurements(ms, cur, { maxCount: MAX_HOVER, radius: RADIUS })

        const sep = new Map<string, { dx: number; dy: number }>()
        const bump = (id: string, dx: number, dy: number) => {
          const c = sep.get(id) ?? { dx: 0, dy: 0 }
          c.dx += dx
          c.dy += dy
          sep.set(id, c)
        }

        // Title: continuous split over ALL nearby letter gaps. Letters left of a gap shift left,
        // right shift right — weighted by strength. Opens exactly the hovered gap, preserves every
        // other kerning pair, and never introduces overlap (adjacent letters only ever move apart).
        const isLetter = (id: string) => placedById.get(id)?.kind === 'letter'
        const titleLetters = placed.filter((b) => b.kind === 'letter')
        for (const m of ms) {
          if (m.type !== 'gap' || !isLetter(m.aId) || !isLetter(m.bId)) continue
          const s = cursorRelevance(m, cur, RADIUS).strength
          if (s <= 0) continue
          const xc = (m.span.x1 + m.span.x2) / 2
          for (const L of titleLetters) bump(L.id, (L.x + L.w / 2 < xc ? -1 : 1) * s * DELTA * 0.5, 0)
        }

        // Words/margins (the selected, non-letter measurements): separate, then relax to cascade.
        for (const { m, strength } of sel) {
          if (m.type === 'gap') {
            if (isLetter(m.aId)) continue // letters handled above
            const s = (DELTA * strength) / 2
            if (m.axis === 'v') {
              bump(m.aId, -s, 0)
              bump(m.bId, s, 0)
            } else {
              bump(m.aId, 0, -s)
              bump(m.bId, 0, s)
            }
          } else {
            const s = DELTA * strength
            if (m.side === 'left') bump(m.elId, s, 0)
            else if (m.side === 'right') bump(m.elId, -s, 0)
            else if (m.side === 'top') bump(m.elId, 0, s)
            else bump(m.elId, 0, -s)
          }
        }

        // relax word units (title block pinned so words flow around it, never shove it on hover).
        // Skip pairs that overlap at HOME (placed) — e.g. the tall title's box vs the line below it,
        // which intersect by design and must NOT be pushed apart.
        const skip = restOverlapPairs(units.map((u) => ({ id: u.id, x: u.x, y: u.y, w: u.w, h: u.h })))
        const solver: SolverBox[] = units.map((u) => {
          const sp = sep.get(u.id) ?? { dx: 0, dy: 0 }
          return { id: u.id, x: u.x + sp.dx, y: u.y + sp.dy, w: u.w, h: u.h, pinned: u.id === 'title' }
        })
        const resolved = relax(solver, { pad: PAD, skip })
        for (const u of units) {
          if (u.id === 'title') continue
          const r = resolved.get(u.id)!
          const t = { dx: r.x - u.x, dy: r.y - u.y }
          targetNudge.set(u.id, t)
          if (Math.hypot(t.dx, t.dy) >= GHOST_MIN) ghosts.push({ box: u, t })
        }
        // letters: apply split directly (no relax — would wrongly spread the resting kerning)
        for (const L of titleLetters) {
          const sp = sep.get(L.id)
          if (sp) targetNudge.set(L.id, sp)
        }

        // word boxes (placed + target nudge) for arrow/word collision checks
        const wordRects: Rect[] = placed
          .filter((b) => b.kind === 'word')
          .map((b) => {
            const n = targetNudge.get(b.id) ?? { dx: 0, dy: 0 }
            return { x: b.x + n.dx, y: b.y + n.dy, w: b.w, h: b.h }
          })

        // measurement arrows (numbers added to `pending`, de-collided globally below)
        for (const { m, strength } of sel) {
          const opacity = clamp(strength, 0.25, 1)
          const track = cursorRelevance(m, cur, RADIUS).track
          let arrow: Extract<Draw, { kind: 'arrowline' }> | null = null
          let value = 0
          if (m.type === 'gap') {
            const opened = Math.max(0, m.gap + DELTA * strength)
            value = opened
            if (opened < 2) continue
            if (m.axis === 'v') arrow = { kind: 'arrowline', orientation: 'h', x: (m.span.x1 + m.span.x2) / 2 - opened / 2, y: track.y, length: opened, opacity }
            else arrow = { kind: 'arrowline', orientation: 'v', x: track.x, y: (m.span.y1 + m.span.y2) / 2 - opened / 2, length: opened, opacity }
          } else if (m.side === 'left' || m.side === 'right') {
            value = m.dist
            arrow = { kind: 'arrowline', orientation: 'h', x: Math.min(m.span.x1, m.span.x2), y: track.y, length: Math.abs(m.span.x2 - m.span.x1), opacity }
          } else {
            value = m.dist
            arrow = { kind: 'arrowline', orientation: 'v', x: track.x, y: Math.min(m.span.y1, m.span.y2), length: Math.abs(m.span.y2 - m.span.y1), opacity }
          }
          if (!arrow) continue
          // keep margin arrows off any word they'd cross (they span negative space)
          if (m.type === 'margin' && crossesAny(arrowBodyRect(arrow), wordRects)) {
            const s = nudgeOffWords(arrow, wordRects)
            arrow.x = s.x
            arrow.y = s.y
          }
          pending.push({ arrow, label: { box: labelBox(arrow, String(Math.round(value))), text: String(Math.round(value)) }, opacity })
        }
      }

      // ===== zero-overlap number layout: push every label clear of words/letters/heads/each other =====
      if (pending.length) {
        const obstacles: Rect[] = []
        // every reactive element box (placed + its target nudge) is an obstacle for numbers
        for (const b of placed) {
          const n = targetNudge.get(b.id) ?? { dx: 0, dy: 0 }
          if (b.kind === 'letter' || b.kind === 'word' || b.id === 'title')
            obstacles.push({ x: b.x + n.dx, y: b.y + n.dy, w: b.w, h: b.h })
        }
        // arrowheads are obstacles too (a number must never sit on a head)
        for (const q of pending) for (const hr of arrowHeadRects(q.arrow)) obstacles.push(hr)
        const labels: SolverBox[] = pending.map((q, i) => ({ id: `lbl${i}`, ...q.label.box }))
        const offs = layoutLabels(labels, obstacles, 2)
        pending.forEach((q, i) => {
          const o = offs.get(`lbl${i}`)!
          draws.push(q.arrow)
          draws.push({ kind: 'label', x: q.label.box.x + o.dx, y: q.label.box.y + o.dy, text: q.label.text, opacity: q.opacity })
        })
      }

      // ghosts (dotted, with perpendicular end ticks) for bounced word/block units
      for (const g of ghosts) {
        const b = g.box
        const n = g.t
        if (Math.abs(n.dx) >= Math.abs(n.dy)) {
          const yc = b.y + b.h / 2
          const edge = n.dx >= 0 ? b.x : b.x + b.w
          draws.push({ kind: 'ghost', x1: edge, y1: yc, x2: edge + n.dx, y2: yc, opacity: 0.5 })
        } else {
          const xc = b.x + b.w / 2
          const edge = n.dy >= 0 ? b.y : b.y + b.h
          draws.push({ kind: 'ghost', x1: xc, y1: edge, x2: xc, y2: edge + n.dy, opacity: 0.5 })
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
            tx = d!.basePlace.dx + d!.dx // pinned to the cursor, no spring
            ty = d!.basePlace.dy + d!.dy
          } else {
            tx = pl.dx + cur.dx
            ty = pl.dy + cur.dy
          }
          const prevApplied = applied.current.get(id)
          if (!prevApplied || prevApplied.dx !== tx || prevApplied.dy !== ty) {
            el.style.transition = 'none'
            el.style.transform = tx || ty ? `translate(${tx}px, ${ty}px)` : ''
            applied.current.set(id, { dx: tx, dy: ty })
          }
        }
      }

      // --- write the pool ---
      for (let i = 0; i < slots.length; i++) {
        const dr = draws[i]
        if (!dr) {
          slots[i].root.style.opacity = '0'
          continue
        }
        paintSlot(slots[i], dr)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stageRef, activityRef, cursorRef])

  return <div ref={poolWrapRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
}

// ---------------------------------------------------------------------------------------------
// drawing helpers
// ---------------------------------------------------------------------------------------------

type Pending = { arrow: Extract<Draw, { kind: 'arrowline' }>; label: { box: Rect; text: string }; opacity: number }

function addBorderArrows(pending: Pending[], live: Box) {
  const left = live.x
  const right = live.x + live.w
  const top = live.y
  const bottom = live.y + live.h
  const cx = live.x + live.w / 2
  const cy = live.y + live.h / 2
  const items: { o: 'h' | 'v'; x: number; y: number; len: number }[] = [
    { o: 'h', x: 0, y: cy, len: left },
    { o: 'h', x: right, y: cy, len: ARTBOARD.w - right },
    { o: 'v', x: cx, y: 0, len: top },
    { o: 'v', x: cx, y: bottom, len: ARTBOARD.h - bottom },
  ]
  for (const it of items) {
    if (it.len <= 0.5) continue
    const arrow: Extract<Draw, { kind: 'arrowline' }> = { kind: 'arrowline', orientation: it.o, x: it.x, y: it.y, length: it.len, opacity: 1 }
    pending.push({ arrow, label: { box: labelBox(arrow, String(Math.round(it.len))), text: String(Math.round(it.len)) }, opacity: 1 })
  }
}

function addGapArrow(pending: Pending[], a: Box, b: Box) {
  const g = gapArrow(a, b)
  if (!g) return
  const arrow: Extract<Draw, { kind: 'arrowline' }> = { kind: 'arrowline', orientation: g.orientation, x: g.left, y: g.top, length: g.length, opacity: 1 }
  pending.push({ arrow, label: { box: labelBox(arrow, String(Math.round(g.gap))), text: String(Math.round(g.gap)) }, opacity: 1 })
}

/** Approximate the arrow's body rect (the line span) for word-collision checks. */
function arrowBodyRect(a: Extract<Draw, { kind: 'arrowline' }>): Rect {
  if (a.orientation === 'h') return { x: a.x, y: a.y - 1, w: a.length, h: 3 }
  return { x: a.x - 1, y: a.y, w: 3, h: a.length }
}

/** The two arrowhead rects (numbers must never sit on a head). */
function arrowHeadRects(a: Extract<Draw, { kind: 'arrowline' }>): Rect[] {
  const s = HEAD + 2
  if (a.orientation === 'h') {
    return [
      { x: a.x - 1, y: a.y - s, w: s, h: s * 2 },
      { x: a.x + a.length - s + 1, y: a.y - s, w: s, h: s * 2 },
    ]
  }
  return [
    { x: a.x - s, y: a.y - 1, w: s * 2, h: s },
    { x: a.x - s, y: a.y + a.length - s + 1, w: s * 2, h: s },
  ]
}

/** The number's natural box (top-left, w, h): seeded in the CLEAR band beside the dimension line —
 * centered just ABOVE an h-arrow (in the empty gap column) / just beside a v-arrow — never on the
 * heads. From here layoutLabels only ever needs to nudge it straight out into clear space, so it
 * escapes even the dense 200px title field cleanly. */
function labelBox(a: Extract<Draw, { kind: 'arrowline' }>, text: string): Rect {
  const tw = Math.max(12, text.length * 7 + 4)
  const th = 13
  if (a.orientation === 'h') return { x: a.x + a.length / 2 - tw / 2, y: a.y - th - 4, w: tw, h: th }
  return { x: a.x + 12, y: a.y + a.length / 2 - th / 2, w: tw, h: th }
}

/** Shift an arrow perpendicular to its axis until its body clears every word (bounded). */
function nudgeOffWords(a: Extract<Draw, { kind: 'arrowline' }>, words: Rect[]): { x: number; y: number } {
  let { x, y } = a
  const STEP = 4
  for (let i = 0; i < 24; i++) {
    const body = a.orientation === 'h' ? { x, y: y - 1, w: a.length, h: 3 } : { x: x - 1, y, w: 3, h: a.length }
    if (!crossesAny(body, words)) break
    if (a.orientation === 'h') y += STEP
    else x += STEP
  }
  return { x, y }
}

/** Write a Draw into a pooled SVG slot (transform/attributes only). */
function paintSlot(slot: PoolSlot, dr: Draw) {
  const show = (el: SVGElement, on: boolean) => {
    el.style.display = on ? '' : 'none'
  }
  show(slot.line, false)
  show(slot.head1, false)
  show(slot.head2, false)
  show(slot.text, false)
  show(slot.guide, false)
  show(slot.tickA, false)
  show(slot.tickB, false)
  slot.root.style.opacity = String(dr.opacity)

  if (dr.kind === 'arrowline') {
    const L = dr.length
    if (dr.orientation === 'h') {
      slot.svg.setAttribute('width', String(L))
      slot.svg.setAttribute('height', '16')
      setLine(slot.line, 0, 8, L, 8)
      slot.head1.setAttribute('points', `${HEAD},${8 - HEAD} 0,8 ${HEAD},${8 + HEAD}`)
      slot.head2.setAttribute('points', `${L - HEAD},${8 - HEAD} ${L},8 ${L - HEAD},${8 + HEAD}`)
      slot.root.style.transform = `translate(${dr.x}px, ${dr.y - 8}px)`
    } else {
      slot.svg.setAttribute('width', '16')
      slot.svg.setAttribute('height', String(L))
      setLine(slot.line, 8, 0, 8, L)
      slot.head1.setAttribute('points', `${8 - HEAD},${HEAD} 8,0 ${8 + HEAD},${HEAD}`)
      slot.head2.setAttribute('points', `${8 - HEAD},${L - HEAD} 8,${L} ${8 + HEAD},${L - HEAD}`)
      slot.root.style.transform = `translate(${dr.x - 8}px, ${dr.y}px)`
    }
    show(slot.line, true)
    show(slot.head1, true)
    show(slot.head2, true)
    return
  }

  if (dr.kind === 'label') {
    slot.svg.setAttribute('width', '40')
    slot.svg.setAttribute('height', '14')
    setText(slot.text, 0, 11, 'start', dr.text)
    slot.root.style.transform = `translate(${dr.x}px, ${dr.y}px)`
    show(slot.text, true)
    return
  }

  if (dr.kind === 'guide') {
    slot.guide.setAttribute('stroke-dasharray', '3 3')
    if (dr.orientation === 'v') {
      const span = ARTBOARD.h
      slot.svg.setAttribute('width', '16')
      slot.svg.setAttribute('height', String(span))
      setLine(slot.guide, 8, 0, 8, span)
      setLine(slot.tickA, 8 - CAP, 0, 8 + CAP, 0)
      setLine(slot.tickB, 8 - CAP, span, 8 + CAP, span)
      slot.root.style.transform = `translate(${dr.pos - 8}px, 0px)`
    } else {
      const span = ARTBOARD.w
      slot.svg.setAttribute('width', String(span))
      slot.svg.setAttribute('height', '16')
      setLine(slot.guide, 0, 8, span, 8)
      setLine(slot.tickA, 0, 8 - CAP, 0, 8 + CAP)
      setLine(slot.tickB, span, 8 - CAP, span, 8 + CAP)
      slot.root.style.transform = `translate(0px, ${dr.pos - 8}px)`
    }
    show(slot.guide, true)
    show(slot.tickA, true)
    show(slot.tickB, true)
    return
  }

  // ghost: finely-dotted segment + a short perpendicular tick at each end (its start/end points)
  const minX = Math.min(dr.x1, dr.x2)
  const minY = Math.min(dr.y1, dr.y2)
  const horizontal = Math.abs(dr.y2 - dr.y1) < Math.abs(dr.x2 - dr.x1)
  const gw = Math.max(1, Math.abs(dr.x2 - dr.x1)) + (horizontal ? 0 : CAP * 2)
  const gh = Math.max(1, Math.abs(dr.y2 - dr.y1)) + (horizontal ? CAP * 2 : 0)
  const ox = horizontal ? 0 : CAP
  const oy = horizontal ? CAP : 0
  slot.svg.setAttribute('width', String(gw))
  slot.svg.setAttribute('height', String(gh))
  slot.guide.setAttribute('stroke-dasharray', '2 3')
  const ax = dr.x1 - minX + ox
  const ay = dr.y1 - minY + oy
  const bx = dr.x2 - minX + ox
  const by = dr.y2 - minY + oy
  setLine(slot.guide, ax, ay, bx, by)
  if (horizontal) {
    setLine(slot.tickA, ax, ay - CAP, ax, ay + CAP)
    setLine(slot.tickB, bx, by - CAP, bx, by + CAP)
  } else {
    setLine(slot.tickA, ax - CAP, ay, ax + CAP, ay)
    setLine(slot.tickB, bx - CAP, by, bx + CAP, by)
  }
  slot.root.style.transform = `translate(${minX - ox}px, ${minY - oy}px)`
  show(slot.guide, true)
  show(slot.tickA, true)
  show(slot.tickB, true)
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

/** A gap arrow from box `a` to neighbor `b`, along whichever axis they're cleanly separated on. */
function gapArrow(a: Box, b: Box): GapArrow | null {
  const aR = a.x + a.w
  const aB = a.y + a.h
  const bR = b.x + b.w
  const bB = b.y + b.h
  const yOverlap = Math.min(aB, bB) - Math.max(a.y, b.y)
  if (yOverlap > 0) {
    if (b.x >= aR) return { orientation: 'h', left: aR, top: (Math.max(a.y, b.y) + Math.min(aB, bB)) / 2, length: b.x - aR, gap: b.x - aR }
    if (a.x >= bR) return { orientation: 'h', left: bR, top: (Math.max(a.y, b.y) + Math.min(aB, bB)) / 2, length: a.x - bR, gap: a.x - bR }
  }
  const xOverlap = Math.min(aR, bR) - Math.max(a.x, b.x)
  if (xOverlap > 0) {
    if (b.y >= aB) return { orientation: 'v', left: (Math.max(a.x, b.x) + Math.min(aR, bR)) / 2, top: aB, length: b.y - aB, gap: b.y - aB }
    if (a.y >= bB) return { orientation: 'v', left: (Math.max(a.x, b.x) + Math.min(aR, bR)) / 2, top: bB, length: a.y - bB, gap: a.y - bB }
  }
  return null
}
