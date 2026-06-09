import { useEffect, useRef } from 'react'
import { composeGrid } from '../grid/compose'
import type { Grid } from '../grid/types'
import { ARTBOARD, HERO_COLORS } from './heroLayout'

/**
 * MorphGrid — a whisper-subtle engine-grid layer that lives in the hero's negative space.
 *
 * Pristine and invisible at rest; as the user interacts it *blooms* (overall opacity rises
 * to a low max) and *morphs* (crossfades between freshly generated engine grids with a small
 * decorative drift), and it *intensifies near the cursor* (a soft radial spotlight lifts the
 * lines you're hovering). Built from the real grid engine (`generate()` over the recursive /
 * modular / nature generators) so the negative space quietly echoes the product itself.
 *
 * emil law, strictly:
 *  - Only `transform` / `opacity` animate. Each rendered piece is a static SVG drawn once by
 *    React; the imperative rAF loop only writes container `opacity` and child `transform`.
 *    Morphs are *crossfades* between two static grid layers (never per-frame geometry edits),
 *    with an optional `blur(2px)` bridge — never width/height/left/top.
 *  - Instant response to input: bloom + spotlight read the live `activityRef` / `cursorRef`
 *    every frame; there is zero React state in the hot path.
 *  - Springs only for decorative nudges: the bloom opacity and spotlight position lerp toward
 *    their targets (a cheap critically-damped spring) — purely decorative easing.
 *  - `prefers-reduced-motion`: no morph cadence, no drift, no spotlight motion; the layer
 *    simply tracks activity opacity (still pristine at rest). Seeds come from a counter and
 *    time only from `performance.now()` inside the loop — never `Math.random`/`Date.now` in
 *    render.
 */

/** Faintest cream hairlines — the negative-space whisper, never louder than the composition. */
const LINE_COLOR = HERO_COLORS.cream
/** Bloom ceiling: the layer never exceeds this overall opacity, even at full activity. */
const MAX_OPACITY = 0.16
/** The empty upper field (slate) the grid is clipped to; below this sits the composition. */
const BLOOM_MAX_Y = 540
/** ms between automatic morphs while the layer is active. */
const MORPH_PERIOD = 4200
/** ms a crossfade between two grid layers takes. */
const MORPH_DURATION = 640
/** Spotlight radius (artboard px) of the soft local intensification around the cursor. */
const SPOTLIGHT_RADIUS = 230
/** Per-frame lerp for the decorative bloom/spotlight springs (snappy, settles ~10 frames). */
const LERP = 0.12

export interface MorphGridProps {
  /** 0..1 interaction intensity, driven by the InteractionLayer (cursor velocity/presence). */
  activityRef: React.MutableRefObject<number>
  /** Live artboard-space cursor point (or null when the pointer has left the stage). */
  cursorRef: React.MutableRefObject<{ x: number; y: number } | null>
  /** Live placed word/block boxes (artboard px) — the grid anchors its columns to these so it
   * always reflects (and works with) the CURRENT composition, not the resting one. */
  compositionRef: React.MutableRefObject<{ x: number; y: number; w: number; h: number }[]>
  /** Bumped when the composition changes — the loop watches it to re-derive a fresh, valid grid
   * that fits the new arrangement (the field "re-breathes" when you move a word). */
  compositionVersion: React.MutableRefObject<number>
}

/** Most module frames to trace (the largest by area) — keep the field layered, never busy. */
const MODULE_DRAW_CAP = 7

/** Render one engine grid's guides + a few module frames into a `<g>`, in artboard px. */
function paintGrid(group: SVGGElement, grid: Grid) {
  // Clear previous children (cheap: this only runs on a morph, never per frame).
  while (group.firstChild) group.removeChild(group.firstChild)
  const NS = 'http://www.w3.org/2000/svg'
  const W = ARTBOARD.w
  // The grid is clipped (via the SVG viewport) to the upper field; draw guides across it.
  const H = BLOOM_MAX_Y

  const line = (x1: number, y1: number, x2: number, y2: number, op: number) => {
    const el = document.createElementNS(NS, 'line')
    el.setAttribute('x1', String(x1))
    el.setAttribute('y1', String(y1))
    el.setAttribute('x2', String(x2))
    el.setAttribute('y2', String(y2))
    el.setAttribute('stroke', LINE_COLOR)
    el.setAttribute('stroke-width', '1')
    el.setAttribute('stroke-opacity', String(op))
    el.setAttribute('vector-effect', 'non-scaling-stroke')
    group.appendChild(el)
  }

  // Guides: full-span hairlines (the structural skeleton). Normalized pos -> artboard px.
  for (const g of grid.guides) {
    if (g.axis === 'v') line(g.pos * W, 0, g.pos * W, H, 0.9)
    else line(0, g.pos * H, W, g.pos * H, 0.9)
  }

  // A few module frames trace the structure — fainter, so the field reads layered, not busy.
  // Cap to the largest cells so a finely-tiled composed grid never floods the field with rects.
  const frames = [...grid.modules].sort((a, b) => b.w * b.h - a.w * a.h).slice(0, MODULE_DRAW_CAP)
  for (const m of frames) {
    const x = m.x * W
    const y = m.y * H
    const w = m.w * W
    const h = m.h * H
    const rect = document.createElementNS(NS, 'rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(w))
    rect.setAttribute('height', String(h))
    rect.setAttribute('fill', 'none')
    rect.setAttribute('stroke', LINE_COLOR)
    rect.setAttribute('stroke-width', '1')
    rect.setAttribute('stroke-opacity', '0.35')
    rect.setAttribute('vector-effect', 'non-scaling-stroke')
    group.appendChild(rect)
  }
}

export function MorphGrid({
  activityRef,
  cursorRef,
  compositionRef,
  compositionVersion,
}: MorphGridProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const layerARef = useRef<SVGGElement>(null)
  const layerBRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const field = fieldRef.current
    const spot = spotRef.current
    const gA = layerARef.current
    const gB = layerBRef.current
    if (!root || !field || !spot || !gA || !gB) return

    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = reduceMq.matches
    const onReduce = (e: MediaQueryListEvent) => {
      reduced = e.matches
    }
    reduceMq.addEventListener('change', onReduce)

    // Seeds come from a monotonic counter (never Math.random) so morphs are stable & varied.
    // Every grid is COMPOSED from the live composition — its columns snap to where the words are
    // now, so the field always reflects the current arrangement and is always a valid tiling.
    let seedCounter = 1
    const nextGrid = (): Grid =>
      composeGrid(seedCounter++, compositionRef.current, ARTBOARD.w, BLOOM_MAX_Y)

    // Two crossfade layers: `front` is fully visible, `back` is staged for the next morph.
    const groups: SVGGElement[] = [gA, gB]
    let frontIdx = 0
    paintGrid(groups[0], nextGrid())
    groups[0].style.opacity = '1'
    groups[1].style.opacity = '0'

    // Decorative spring state (lerped each frame; purely cosmetic easing).
    let bloom = 0 // eased overall opacity factor 0..1
    let spotX = ARTBOARD.w / 2
    let spotY = BLOOM_MAX_Y / 2
    let spotOpacity = 0

    // Morph state: when a crossfade is in flight, t goes 0->1 over MORPH_DURATION.
    let morphStart = -1
    // Seed lastMorph to "now" so the first grid lingers a full period before the first morph.
    let lastMorph = performance.now()
    // Last composition version we've reflected; when it changes we re-derive a fitting grid.
    let seenVersion = compositionVersion.current
    // Decorative drift of the front layer (a slow parallax wander while active).
    let driftPhase = 0

    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

    let raf = 0
    let prev = performance.now()

    const beginMorph = (now: number) => {
      const back = groups[1 - frontIdx]
      paintGrid(back, nextGrid())
      back.style.opacity = '0'
      morphStart = now
      lastMorph = now
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(48, now - prev)
      prev = now

      // --- targets from live refs (instant response) ---
      const activity = Math.max(0, Math.min(1, activityRef.current))
      const cursor = cursorRef.current

      // --- bloom spring: overall opacity follows activity (decorative ease) ---
      bloom += (activity - bloom) * LERP
      const overall = bloom * MAX_OPACITY
      root.style.opacity = overall.toFixed(4)

      // --- spotlight: soft local lift that tracks the cursor (transform/opacity only) ---
      const overField = !!cursor && cursor.y < BLOOM_MAX_Y + 60
      const spotTarget = overField ? Math.max(0, Math.min(1, activity * 1.2)) : 0
      if (reduced) {
        // No motion under reduced-motion: park the spotlight, keep only the activity opacity.
        spotOpacity += (0 - spotOpacity) * LERP
      } else {
        if (cursor) {
          spotX += (cursor.x - spotX) * (LERP * 1.6)
          spotY += (cursor.y - spotY) * (LERP * 1.6)
        }
        spotOpacity += (spotTarget - spotOpacity) * LERP
        spot.style.transform = `translate(${(spotX - SPOTLIGHT_RADIUS).toFixed(1)}px, ${(
          spotY - SPOTLIGHT_RADIUS
        ).toFixed(1)}px)`
      }
      spot.style.opacity = spotOpacity.toFixed(4)

      // --- morph cadence + crossfade (opacity only, with a brief blur bridge) ---
      if (!reduced) {
        const front = groups[frontIdx]
        const back = groups[1 - frontIdx]

        // Re-derive when the composition changed (re-breathe on a move), or on the idle cadence.
        if (morphStart < 0) {
          const versionChanged = compositionVersion.current !== seenVersion
          if (versionChanged) seenVersion = compositionVersion.current
          const periodic = activity > 0.04 && now - lastMorph > MORPH_PERIOD
          if (versionChanged || periodic) beginMorph(now)
        }

        if (morphStart >= 0) {
          const t = Math.min(1, (now - morphStart) / MORPH_DURATION)
          const e = easeInOut(t)
          back.style.opacity = e.toFixed(4)
          front.style.opacity = (1 - e).toFixed(4)
          // emil's crossfade trick: a subtle blur bridge that peaks mid-fade, then clears.
          const blur = Math.sin(t * Math.PI) * 2
          field.style.filter = blur > 0.02 ? `blur(${blur.toFixed(2)}px)` : 'none'
          if (t >= 1) {
            morphStart = -1
            field.style.filter = 'none'
            frontIdx = 1 - frontIdx
          }
        }

        // --- decorative drift: a slow parallax wander of the whole field while active ---
        driftPhase += dt * 0.00018
        const amp = 5 * bloom
        const dx = Math.cos(driftPhase) * amp
        const dy = Math.sin(driftPhase * 0.8) * amp * 0.5
        const scale = 1 + 0.012 * bloom
        field.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`
      } else {
        // Reduced motion: no crossfade/drift, but still keep the grid faithful to the composition
        // by swapping instantly (never animated) when the arrangement changes.
        field.style.transform = 'none'
        field.style.filter = 'none'
        if (compositionVersion.current !== seenVersion) {
          seenVersion = compositionVersion.current
          paintGrid(groups[frontIdx], nextGrid())
          groups[frontIdx].style.opacity = '1'
          groups[1 - frontIdx].style.opacity = '0'
        }
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      reduceMq.removeEventListener('change', onReduce)
    }
  }, [activityRef, cursorRef])

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0, // starts pristine; the loop raises it with activity
        willChange: 'opacity',
        zIndex: 0,
      }}
    >
      {/* The drifting field: a clipped viewport over the upper negative space. transform-only. */}
      <div
        ref={fieldRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: ARTBOARD.w,
          height: BLOOM_MAX_Y,
          overflow: 'hidden',
          transformOrigin: '50% 35%',
          willChange: 'transform, filter',
        }}
      >
        <svg
          width={ARTBOARD.w}
          height={BLOOM_MAX_Y}
          viewBox={`0 0 ${ARTBOARD.w} ${BLOOM_MAX_Y}`}
          style={{ position: 'absolute', inset: 0, display: 'block', overflow: 'visible' }}
        >
          {/* Two crossfade layers; only their group opacity/transform animate. */}
          <g ref={layerARef} style={{ willChange: 'opacity' }} />
          <g ref={layerBRef} style={{ willChange: 'opacity' }} />
        </svg>
      </div>

      {/* Soft radial spotlight that lifts the grid near the cursor. transform/opacity only. */}
      <div
        ref={spotRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SPOTLIGHT_RADIUS * 2,
          height: SPOTLIGHT_RADIUS * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${LINE_COLOR} 0%, rgba(244,240,232,0.18) 38%, transparent 70%)`,
          mixBlendMode: 'screen',
          opacity: 0,
          willChange: 'transform, opacity',
        }}
      />
    </div>
  )
}
