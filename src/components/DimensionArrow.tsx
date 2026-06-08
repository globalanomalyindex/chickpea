interface Props {
  orientation: 'h' | 'v' // h = horizontal double arrow (measuring an x-gap); v = vertical
  /** length of the arrow in px (the measured span). */
  length: number
  /** label text, e.g. "20" or "φ". */
  label: string
  color?: string
  /** stroke width in px. */
  strokeWidth?: number
}

/**
 * A measurement arrow: a line with arrowheads at both ends and a centered value.
 * Rendered in its own local coordinate space; the caller positions/rotates it.
 */
export function DimensionArrow({ orientation, length, label, color = '#4e6a7a', strokeWidth = 1.5 }: Props) {
  const head = 5
  if (orientation === 'h') {
    return (
      <svg width={length} height={16} style={{ overflow: 'visible', display: 'block' }}>
        <line x1={0} y1={8} x2={length} y2={8} stroke={color} strokeWidth={strokeWidth} />
        <polyline points={`${head},${8 - head} 0,8 ${head},${8 + head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <polyline points={`${length - head},${8 - head} ${length},8 ${length - head},${8 + head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <text x={length / 2} y={4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill={color}>{label}</text>
      </svg>
    )
  }
  return (
    <svg width={16} height={length} style={{ overflow: 'visible', display: 'block' }}>
      <line x1={8} y1={0} x2={8} y2={length} stroke={color} strokeWidth={strokeWidth} />
      <polyline points={`${8 - head},${head} 8,0 ${8 + head},${head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <polyline points={`${8 - head},${length - head} 8,${length} ${8 + head},${length - head}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <text x={12} y={length / 2} textAnchor="start" fontFamily="var(--font-mono)" fontSize={11} fill={color}>{label}</text>
    </svg>
  )
}
