import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Grid, Module } from '../grid/types'
import { DimensionArrow } from '../components/DimensionArrow'

interface Props {
  grid: Grid
  size?: number
  aspect?: number
  show: boolean
}

const INK = '#f4f0e8'
/** measure-ink language: cream hairlines, mono labels, faint halo for legibility over color. */
const GUIDE_W = 0.0015
const OUTLINE_W = 0.001

function largestModule(grid: Grid): Module {
  return grid.modules.reduce((p, c) => (c.w * c.h > p.w * p.h ? c : p), grid.modules[0])
}

/**
 * The studio echo of the hero's Measure layer: overlays the composition's math —
 * guides, module outlines, hover dims, ratio labels — in the cream dimension-arrow
 * vocabulary. Reuses DimensionArrow for the dominant module's measured width.
 */
export function SkeletonReveal({ grid, size = 640, aspect, show }: Props) {
  const a = aspect ?? grid.aspect ?? 1
  const w = a >= 1 ? size : size * a
  const h = a >= 1 ? size / a : size
  const [hover, setHover] = useState<number | null>(null)

  const dom = largestModule(grid)
  const domWidthPx = dom.w * w

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'absolute', inset: 0, width: w, height: h, pointerEvents: 'none' }}
        >
          <svg
            width={w}
            height={h}
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, display: 'block', overflow: 'visible' }}
          >
            {/* soft halo so the ink reads over light modules too */}
            <defs>
              <filter id="halo" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="0.004" floodColor="#2a2e31" floodOpacity="0.5" />
              </filter>
            </defs>

            <g filter="url(#halo)">
              {/* module outlines (hairline) */}
              {grid.modules.map((m, i) => (
                <rect
                  key={i}
                  x={m.x}
                  y={m.y}
                  width={m.w}
                  height={m.h}
                  fill="transparent"
                  stroke={INK}
                  strokeOpacity={hover === i ? 0.95 : 0.5}
                  strokeWidth={hover === i ? OUTLINE_W * 1.8 : OUTLINE_W}
                  pointerEvents="all"
                  style={{ pointerEvents: 'all' }}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover((v) => (v === i ? null : v))}
                />
              ))}

              {/* guide hairlines */}
              {grid.guides.map((g, i) =>
                g.axis === 'v' ? (
                  <line key={i} x1={g.pos} y1={0} x2={g.pos} y2={1} stroke={INK} strokeOpacity={0.6} strokeWidth={GUIDE_W} />
                ) : (
                  <line key={i} x1={0} y1={g.pos} x2={1} y2={g.pos} stroke={INK} strokeOpacity={0.6} strokeWidth={GUIDE_W} />
                ),
              )}
            </g>
          </svg>

          {/* hover dims: the module's pixel size, in mono, near its top-left */}
          {hover !== null && grid.modules[hover] && (
            <span
              style={{
                position: 'absolute',
                left: grid.modules[hover].x * w + 4,
                top: grid.modules[hover].y * h + 3,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: INK,
                whiteSpace: 'nowrap',
                textShadow: '0 0 3px rgba(42,46,49,0.7)',
                pointerEvents: 'none',
              }}
            >
              {Math.round(grid.modules[hover].w * w)} × {Math.round(grid.modules[hover].h * h)}
            </span>
          )}

          {/* a worked dimension: the dominant module's width, via the shared arrow primitive */}
          <div
            style={{
              position: 'absolute',
              left: dom.x * w,
              top: (dom.y + dom.h) * h + 8,
              filter: 'drop-shadow(0 0 3px rgba(42,46,49,0.7))',
              pointerEvents: 'none',
            }}
          >
            <DimensionArrow orientation="h" length={domWidthPx} label={`${Math.round(domWidthPx)}px`} color={INK} />
          </div>

          {/* ratio labels in mono, stacked at the top-left */}
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: INK,
              textShadow: '0 0 3px rgba(42,46,49,0.7)',
              pointerEvents: 'none',
            }}
          >
            {grid.ratios.map((r, i) => (
              <span key={i}>
                {r.name} {r.value.toFixed(3)}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
