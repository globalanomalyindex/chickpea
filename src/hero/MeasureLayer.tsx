import { useEffect, useRef, useState } from 'react'
import { clientToStage, type Stage } from './stageScale'
import {
  buildMeasurements,
  selectMeasurements,
  cursorRelevance,
  elementOffsets,
  type Pt,
  type Selected,
} from './measurements'
import { ARTBOARD, HERO_COLORS } from './heroLayout'
import { DimensionArrow } from '../components/DimensionArrow'
import { measureBoxes, queryReactiveEls, applyTransform, type PlacementMap } from './heroDom'

/** Cursor proximity radius (artboard px) within which a measurement lights up. */
const RADIUS = 150
/** Transient separation amount (artboard px) applied to nudged elements at full strength. */
const DELTA = 26
/** Calm, not chaotic: never more than this many arrows at once. */
const MAX_COUNT = 4
/** Skip margins larger than this (artboard px): a word sitting far from a border has a huge
 * margin whose arrow would span most of the page — overwhelming, not informative. Only the
 * tight breathing-room margins around words surface; the big negative space is the bloom's. */
const MAX_MARGIN = 240
/** The empty upper field (slate) where the grid blooms. Below this is the composition. */
const BLOOM_MAX_Y = 540

interface Props {
  stage: Stage
  stageRef: React.RefObject<HTMLDivElement>
  placement: PlacementMap
}

interface Bloom {
  x: number
  y: number
}

export function MeasureLayer({ stage, stageRef, placement }: Props) {
  const [selected, setSelected] = useState<Selected[]>([])
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [bloom, setBloom] = useState<Bloom | null>(null)
  const reduced = useRef(false)
  /** Currently-applied translate per element id, so re-measurement yields resting coords. */
  const applied = useRef<Map<string, { dx: number; dy: number }>>(new Map())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Pointer tracking -> ranked measurements + grid bloom, throttled to rAF.
  useEffect(() => {
    const root = stageRef.current
    if (!root) return
    let raf = 0
    function onMove(e: PointerEvent) {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = stageRef.current
        if (!r) return
        const p = clientToStage(e.clientX, e.clientY, stage)
        const boxes = measureBoxes(r, stage, applied.current)
        const candidates = buildMeasurements(boxes, ARTBOARD).filter(
          (m) => m.type !== 'margin' || m.dist <= MAX_MARGIN,
        )
        const sel = selectMeasurements(candidates, p, {
          maxCount: MAX_COUNT,
          radius: RADIUS,
        })
        setSelected(sel)
        setCursor(p)
        // grid blooms only in the empty upper field and only when nothing is selected
        setBloom(sel.length === 0 && p.y < BLOOM_MAX_Y ? { x: p.x, y: p.y } : null)
      })
    }
    function onLeave() {
      setSelected([])
      setCursor(null)
      setBloom(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [stage, stageRef])

  // Apply placement (persisted) + transient hover nudges to the real elements. Anything
  // not in the current offset map springs back to its placement (or identity). Reduced
  // motion keeps placements but skips the transient nudges.
  useEffect(() => {
    const root = stageRef.current
    if (!root) return

    const nudges = reduced.current
      ? new Map<string, { dx: number; dy: number }>()
      : elementOffsets(selected, DELTA)
    const els = queryReactiveEls(root)
    const all: { el: HTMLElement; id: string }[] = [
      ...els.letters.map((el) => ({ el, id: el.dataset.letter! })),
      ...els.words.map((el) => ({ el, id: el.dataset.word! })),
      ...els.blocks.map((el) => ({ el, id: el.dataset.block! })),
    ]

    for (const { el, id } of all) {
      const place = placement[id] ?? { dx: 0, dy: 0 }
      const nudge = nudges.get(id) ?? { dx: 0, dy: 0 }
      applyTransform(el, id, place.dx + nudge.dx, place.dy + nudge.dy, applied.current)
    }
  }, [selected, placement, stageRef])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {bloom && <GridBloom x={bloom.x} y={bloom.y} />}
      {cursor &&
        selected.map((s) => <MeasureArrow key={s.m.id} sel={s} cursor={cursor} />)}
    </div>
  )
}

/**
 * One cursor-tracked dimension arrow for a selected measurement. The draw point follows the
 * cursor along the gap/margin (recomputed live via cursorRelevance.track); opacity fades
 * with strength so the primary reads full and secondaries sit back.
 */
function MeasureArrow({ sel, cursor }: { sel: Selected; cursor: Pt }) {
  const { m, strength } = sel
  const c = HERO_COLORS.cream
  const opacity = Math.max(0.2, strength)
  const track = cursorRelevance(m, cursor, RADIUS).track

  if (m.type === 'gap') {
    // The arrow measures the gap AS IT OPENS under the symmetric nudge (resting gap + the
    // separation), centered on the gap and tracking the cursor along the shared edge. This
    // keeps the readout a clean positive "space you've opened" even where the resting boxes
    // are tightly kerned or overlapping (which would otherwise read as a negative number).
    const opened = Math.max(0, m.gap + DELTA * strength)
    if (opened < 3) return null
    if (m.axis === 'v') {
      const mid = (m.span.x1 + m.span.x2) / 2
      return (
        <ArrowAt left={mid - opened / 2} top={track.y}>
          <DimensionArrow orientation="h" length={opened} label={String(Math.round(opened))} color={c} opacity={opacity} />
        </ArrowAt>
      )
    }
    const mid = (m.span.y1 + m.span.y2) / 2
    return (
      <ArrowAt left={track.x} top={mid - opened / 2}>
        <DimensionArrow orientation="v" length={opened} label={String(Math.round(opened))} color={c} opacity={opacity} />
      </ArrowAt>
    )
  }

  // margin: an arrow from the page border to the element edge, labeled with the margin size.
  if (m.side === 'left' || m.side === 'right') {
    const len = Math.abs(m.span.x2 - m.span.x1)
    const left = Math.min(m.span.x1, m.span.x2)
    return (
      <ArrowAt left={left} top={track.y}>
        <DimensionArrow orientation="h" length={len} label={String(Math.round(m.dist))} color={c} opacity={opacity} />
      </ArrowAt>
    )
  }
  const len = Math.abs(m.span.y2 - m.span.y1)
  const top = Math.min(m.span.y1, m.span.y2)
  return (
    <ArrowAt left={track.x} top={top}>
      <DimensionArrow orientation="v" length={len} label={String(Math.round(m.dist))} color={c} opacity={opacity} />
    </ArrowAt>
  )
}

/** Positions an arrow at an artboard point. The position tracks the cursor with a fast,
 * lag-free curve (short linear so it reads as immediate, not floaty). */
function ArrowAt({ left, top, children }: { left: number; top: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        transition: 'left 90ms linear, top 90ms linear',
      }}
    >
      {children}
    </div>
  )
}

/**
 * A faint cross of guide lines through the pointer in the empty upper field, with small tick
 * labels reading the pointer's artboard coordinates — a subtle nod to the grid tool.
 */
function GridBloom({ x, y }: { x: number; y: number }) {
  const c = HERO_COLORS.cream
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.42 }}>
      {/* vertical guide */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: 0,
          width: 1,
          height: BLOOM_MAX_Y,
          background: `linear-gradient(to bottom, transparent, ${c} 40%, ${c} 60%, transparent)`,
        }}
      />
      {/* horizontal guide */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: '100%',
          height: 1,
          background: `linear-gradient(to right, transparent, ${c} 40%, ${c} 60%, transparent)`,
        }}
      />
      {/* coordinate tick labels */}
      <span
        style={{
          position: 'absolute',
          left: x + 6,
          top: y + 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: c,
          whiteSpace: 'nowrap',
        }}
      >
        {Math.round(x)}, {Math.round(y)}
      </span>
    </div>
  )
}
