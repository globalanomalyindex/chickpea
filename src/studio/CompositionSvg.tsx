import { useMemo } from 'react'
import type { Grid } from '../grid/types'
import type { Composition, CompModule } from './composition'
import { fitText } from '../type/typography-fit'
import { measureLine, REF_SIZE } from '../type/measure'
import { hexToRgb, luminance } from '../palette/hsl'

interface Props {
  composition: Composition
  grid: Grid
  /** rendered pixel size of the longest edge. */
  size?: number
  /** w/h aspect; defaults to the grid's aspect. */
  aspect?: number
  className?: string
  style?: React.CSSProperties
}

const LIGHT_INK = '#f4f0e8'
const DARK_INK = '#2a2e31'
/** padding inside each module rect, as a fraction of the smaller module edge. */
const TEXT_PAD = 0.14

/** Legible ink over a fill: cream on dark modules, near-black on light. */
function inkFor(hex: string): string {
  return luminance(hexToRgb(hex)) < 0.42 ? LIGHT_INK : DARK_INK
}

function ModuleText({ cm }: { cm: CompModule }) {
  const { module: m, text } = cm
  if (!text) return null
  const fit = fitText({
    text,
    width: m.w,
    height: m.h,
    measure: measureLine,
    refSize: REF_SIZE,
    lineHeight: 1,
    padding: TEXT_PAD,
  })
  const ink = inkFor(cm.color)
  const innerH = m.h * (1 - 2 * TEXT_PAD)
  const padY = (m.h - innerH) / 2
  const lineCount = fit.lines.length
  // each line occupies a band of innerH/lineCount, baseline centered in its band
  return (
    <g>
      {fit.lines.map((ln, i) => {
        // band center y within the inner box
        const bandH = innerH / lineCount
        const cy = m.y + padY + bandH * (i + 0.5)
        const cx = m.x + m.w / 2
        // glyph drawn at REF_SIZE in local space, then scaled into viewBox units.
        // vertical centering: REF_SIZE em, baseline ~0.72 down from the cap top.
        return (
          <text
            key={i}
            x={0}
            y={0}
            transform={`translate(${cx} ${cy}) scale(${ln.scaleX} ${ln.scaleY})`}
            fontFamily="Mafinest, Georgia, serif"
            fontSize={REF_SIZE}
            fill={ink}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {ln.text}
          </text>
        )
      })}
    </g>
  )
}

export function CompositionSvg({ composition, grid, size = 640, aspect, style, className }: Props) {
  const a = aspect ?? grid.aspect ?? 1
  const w = a >= 1 ? size : size * a
  const h = a >= 1 ? size / a : size
  const modules = useMemo(() => composition.modules, [composition])

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className={className}
      style={{ display: 'block', ...style }}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={1} height={1} fill={composition.background} />
      {modules.map((cm, i) => (
        <rect key={i} x={cm.module.x} y={cm.module.y} width={cm.module.w} height={cm.module.h} fill={cm.color} />
      ))}
      <g shapeRendering="auto">
        {modules.map((cm, i) => (
          <ModuleText key={i} cm={cm} />
        ))}
      </g>
    </svg>
  )
}
