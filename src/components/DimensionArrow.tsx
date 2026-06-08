interface Props {
  orientation: 'h' | 'v' // h = horizontal double arrow (measuring an x-gap); v = vertical
  /** length of the arrow in px (the measured span). */
  length: number
  /** label text, e.g. "20" or "φ". */
  label: string
  color?: string
  /** stroke width in px. */
  strokeWidth?: number
  /** overall opacity 0..1 — used to fade subordinate (secondary) measurements. */
  opacity?: number
}

/**
 * A measurement arrow: a line with arrowheads at both ends and a centered value.
 * Rendered in its own local coordinate space; the caller positions/rotates it.
 */
export function DimensionArrow({ orientation, length, label, color = '#4e6a7a', strokeWidth = 1.5, opacity = 1 }: Props) {
  const head = 5
  if (orientation === 'h') {
    return (
      <svg width={length} height={16} style={{ overflow: 'visible', display: 'block', opacity }}>
        <line x1={0} y1={8} x2={length} y2={8} stroke={color} strokeWidth={strokeWidth} />
        <polyline points={`${head},${8 - head} 0,8 ${head},${8 + head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <polyline points={`${length - head},${8 - head} ${length},8 ${length - head},${8 + head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <text x={length / 2} y={4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill={color}>{label}</text>
      </svg>
    )
  }
  return (
    <svg width={16} height={length} style={{ overflow: 'visible', display: 'block', opacity }}>
      <line x1={8} y1={0} x2={8} y2={length} stroke={color} strokeWidth={strokeWidth} />
      <polyline points={`${8 - head},${head} 8,0 ${8 + head},${head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <polyline points={`${8 - head},${length - head} 8,${length} ${8 + head},${length - head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <text x={12} y={length / 2} textAnchor="start" fontFamily="var(--font-mono)" fontSize={11} fill={color}>{label}</text>
    </svg>
  )
}

interface GuideLineProps {
  /** 'v' = a vertical guide at x; 'h' = a horizontal guide at y. */
  orientation: 'h' | 'v'
  /** the fixed coordinate (x for 'v', y for 'h') in the parent's local space. */
  pos: number
  /** full span length along the guide's axis (artboard height for 'v', width for 'h'). */
  span: number
  color?: string
  strokeWidth?: number
  opacity?: number
}

/**
 * A thin full-span alignment guide with small end ticks — drawn through a snap line
 * during the drag layout. Same cream measure-ink vocabulary as DimensionArrow.
 */
export function GuideLine({ orientation, pos, span, color = '#f4f0e8', strokeWidth = 1, opacity = 0.9 }: GuideLineProps) {
  const tick = 4
  if (orientation === 'v') {
    return (
      <svg
        width={16}
        height={span}
        style={{ position: 'absolute', left: pos - 8, top: 0, overflow: 'visible', display: 'block', opacity, pointerEvents: 'none' }}
      >
        <line x1={8} y1={0} x2={8} y2={span} stroke={color} strokeWidth={strokeWidth} strokeDasharray="3 3" />
        <line x1={8 - tick} y1={0} x2={8 + tick} y2={0} stroke={color} strokeWidth={strokeWidth} />
        <line x1={8 - tick} y1={span} x2={8 + tick} y2={span} stroke={color} strokeWidth={strokeWidth} />
      </svg>
    )
  }
  return (
    <svg
      width={span}
      height={16}
      style={{ position: 'absolute', left: 0, top: pos - 8, overflow: 'visible', display: 'block', opacity, pointerEvents: 'none' }}
    >
      <line x1={0} y1={8} x2={span} y2={8} stroke={color} strokeWidth={strokeWidth} strokeDasharray="3 3" />
      <line x1={0} y1={8 - tick} x2={0} y2={8 + tick} stroke={color} strokeWidth={strokeWidth} />
      <line x1={span} y1={8 - tick} x2={span} y2={8 + tick} stroke={color} strokeWidth={strokeWidth} />
    </svg>
  )
}
