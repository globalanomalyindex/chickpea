import { useLayoutEffect, useRef, useState } from 'react'
import { DimensionArrow } from '../../components/DimensionArrow'
import { Figure } from '../Figure'

const WORD = 'Chickpea'
const STEEL = '#4e6a7a'
const SLATE = '#5d646b'
const DELTA = 16 // px each side separates on hover

interface Gap {
  /** gap center x in container px. */
  center: number
  /** the live measured gap in px (includes the spring separation). */
  value: number
}

/**
 * A compact, self-contained echo of the hero's Measure primitive: the word "Chickpea",
 * where hovering a seam between two letters spring-separates the two sides and draws a
 * dimension arrow reading the gap it just opened — the same `DimensionArrow` the hero and
 * the skeleton reveal use. Reduced-motion is honored: the arrow still appears, the letters
 * do not slide.
 */
export function MeasureFigure() {
  const stripRef = useRef<HTMLDivElement>(null)
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [gap, setGap] = useState<Gap | null>(null)
  const reduced = useRef(false)
  /** Bumped when the reduced-motion media query changes, to re-render with the new setting. */
  const [reducedTick, setReducedTick] = useState(0)

  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => {
      reduced.current = e.matches
      // re-render so render-time letter offsets and the gap readout pick up the new setting
      setReducedTick((t) => t + 1)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // measure the active seam in container coordinates whenever it changes. We read the
  // resting geometry (letters not yet transformed at this layout tick) and add the spring
  // separation analytically, so the readout is stable rather than chasing the animation.
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (active === null || !strip) {
      setGap(null)
      return
    }
    const left = letterRefs.current[active]
    const right = letterRefs.current[active + 1]
    if (!left || !right) return
    const base = strip.getBoundingClientRect()
    const lr = left.getBoundingClientRect()
    const rr = right.getBoundingClientRect()
    const naturalGap = rr.left - lr.right
    const separation = reduced.current ? 0 : 2 * DELTA
    setGap({
      center: (lr.right + rr.left) / 2 - base.left,
      value: Math.round(naturalGap + separation),
    })
  }, [active, reducedTick])

  return (
    <Figure
      index="04"
      title="The Measure primitive"
      caption="The hero's signature move, in miniature. Hover the space between two letters: the seam springs apart and a dimension arrow measures the gap it just exposed — invisible spacing made literal. The same primitive draws every grid's skeleton on demand. Springs, not easing, are what make it read as alive."
    >
      <div
        ref={stripRef}
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 160,
          padding: '40px 0',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px, 9vw, 76px)',
          color: SLATE,
          userSelect: 'none',
        }}
        onPointerLeave={() => setActive(null)}
      >
        {[...WORD].map((ch, i) => {
          // a letter shifts when it borders the active seam: left side of seam moves left,
          // right side moves right.
          let dx = 0
          if (active !== null && !reduced.current) {
            if (i <= active) dx = -DELTA
            else dx = DELTA
          }
          return (
            <span
              key={i}
              ref={(el) => (letterRefs.current[i] = el)}
              style={{
                display: 'inline-block',
                transform: `translateX(${dx}px)`,
                transition: 'transform 320ms cubic-bezier(.22,1,.36,1)',
              }}
            >
              {/* hover targets: the right half of each letter arms the seam to its right */}
              {i < WORD.length - 1 && (
                <span
                  onPointerEnter={() => setActive(i)}
                  style={{
                    position: 'absolute',
                    display: 'inline-block',
                    width: '0.6em',
                    height: '1em',
                    transform: 'translateX(0.7em)',
                    cursor: 'col-resize',
                  }}
                  aria-hidden
                />
              )}
              {ch}
            </span>
          )
        })}

        {gap && (
          <div
            style={{
              position: 'absolute',
              left: gap.center - Math.max(8, gap.value) / 2,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <DimensionArrow
              orientation="h"
              length={Math.max(8, gap.value)}
              label={String(gap.value)}
              color={STEEL}
            />
          </div>
        )}
      </div>
    </Figure>
  )
}
