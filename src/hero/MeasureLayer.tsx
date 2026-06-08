import { useEffect, useRef, useState } from 'react'
import { clientToStage, type Stage } from './stageScale'
import { buildSeams, nearestSeam, separationOffset, type Box, type Seam, type SeamGroup } from './seams'
import { DimensionArrow } from '../components/DimensionArrow'
import { HERO_COLORS } from './heroLayout'

const RADIUS = 90
const DELTA = 26
const EASE = 'transform 260ms cubic-bezier(.22,1,.36,1)'
/** The empty upper field (slate) where the grid blooms. Below this is the composition. */
const BLOOM_MAX_Y = 540

interface Props {
  stage: Stage
  stageRef: React.RefObject<HTMLDivElement>
}

interface Bloom {
  x: number
  y: number
}

export function MeasureLayer({ stage, stageRef }: Props) {
  const [seam, setSeam] = useState<Seam | null>(null)
  const [bloom, setBloom] = useState<Bloom | null>(null)
  const reduced = useRef(false)
  /** Currently-applied separation offset per element id, so re-measurement yields resting coords. */
  const applied = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  /**
   * Measure rendered boxes in ARTBOARD coordinates. We express each element's
   * getBoundingClientRect relative to the (scaled) stage root rect, then divide by
   * stage.scale. Any separation transform currently applied to an element is subtracted
   * back out so we always build seams from the resting composition, never a moving target.
   */
  function measureGroups(): SeamGroup[] {
    const root = stageRef.current
    if (!root) return []
    const stageRect = root.getBoundingClientRect()
    const toBox = (el: Element, id: string, axis: 'x' | 'y'): Box => {
      const r = el.getBoundingClientRect()
      const off = applied.current.get(id) ?? 0
      const x = (r.left - stageRect.left) / stage.scale - (axis === 'x' ? off : 0)
      const y = (r.top - stageRect.top) / stage.scale - (axis === 'y' ? off : 0)
      return { id, x, y, w: r.width / stage.scale, h: r.height / stage.scale }
    }

    const groups: SeamGroup[] = []

    // title: per-letter spans, sorted by x -> vertical seams
    const letters = [...root.querySelectorAll<HTMLElement>('[data-letter^="title-"]')]
      .map((el) => toBox(el, el.dataset.letter!, 'x'))
      .sort((a, b) => a.x - b.x)
    if (letters.length > 1) groups.push({ group: 'title', boxes: letters, axis: 'x' })

    // blocks: block wrappers, sorted by y -> horizontal seams
    const blocks = [...root.querySelectorAll<HTMLElement>('[data-block]')]
      .map((el) => toBox(el, el.dataset.block!, 'y'))
      .sort((a, b) => a.y - b.y)
    if (blocks.length > 1) groups.push({ group: 'blocks', boxes: blocks, axis: 'y' })

    return groups
  }

  // Pointer tracking -> active seam + grid bloom, throttled to rAF.
  useEffect(() => {
    let raf = 0
    function onMove(e: PointerEvent) {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const p = clientToStage(e.clientX, e.clientY, stage)
        const hit = nearestSeam(buildSeams(measureGroups()), p, RADIUS)
        setSeam(hit)
        // grid blooms only in the empty upper field and only when no seam is active
        setBloom(!hit && p.y < BLOOM_MAX_Y ? { x: p.x, y: p.y } : null)
      })
    }
    function onLeave() {
      setSeam(null)
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
  }, [stage])

  // Apply separation transforms to the actual letter/block elements.
  useEffect(() => {
    const root = stageRef.current
    if (!root) return
    const active = seam && !reduced.current ? seam : null

    const letters = [...root.querySelectorAll<HTMLElement>('[data-letter^="title-"]')]
    const titleIds = letters.map((el) => el.dataset.letter!)
    for (const el of letters) {
      const id = el.dataset.letter!
      const off =
        active && active.group === 'title' ? separationOffset(active, id, titleIds, DELTA) : 0
      applied.current.set(id, off)
      el.style.transition = EASE
      el.style.transform = off ? `translateX(${off}px)` : ''
    }

    const blocks = [...root.querySelectorAll<HTMLElement>('[data-block]')].sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )
    const blockIds = blocks.map((el) => el.dataset.block!)
    for (const el of blocks) {
      const id = el.dataset.block!
      const off =
        active && active.group === 'blocks' ? separationOffset(active, id, blockIds, DELTA) : 0
      applied.current.set(id, off)
      el.style.transition = EASE
      el.style.transform = off ? `translateY(${off}px)` : ''
    }
  }, [seam, stageRef])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {bloom && <GridBloom x={bloom.x} y={bloom.y} />}
      {seam && <SeamArrow seam={seam} />}
    </div>
  )
}

/** The dimension arrow drawn across the active seam, growing with the separation. */
function SeamArrow({ seam }: { seam: Seam }) {
  const arrowLen = seam.gap + DELTA
  return (
    <div
      style={{
        position: 'absolute',
        left: seam.axis === 'v' ? seam.center.x - arrowLen / 2 : seam.center.x,
        top: seam.axis === 'v' ? seam.center.y : seam.center.y - arrowLen / 2,
        transition: 'left 260ms cubic-bezier(.22,1,.36,1), top 260ms cubic-bezier(.22,1,.36,1)',
      }}
    >
      <DimensionArrow
        orientation={seam.axis === 'v' ? 'h' : 'v'}
        length={arrowLen}
        label={String(Math.round(seam.gap + DELTA))}
        color={HERO_COLORS.cream}
      />
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
