import type { Grid } from '../grid/types'

interface Props {
  grid: Grid
  size?: number
  showModules?: boolean
  showGuides?: boolean
}

export function GridSvg({ grid, size = 560, showModules = true, showGuides = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1 1"
      style={{ background: 'var(--cream)', display: 'block' }}
    >
      {showModules &&
        grid.modules.map((m, i) => (
          <rect
            key={i}
            x={m.x}
            y={m.y}
            width={m.w}
            height={m.h}
            fill="none"
            stroke="var(--slate)"
            strokeWidth={0.002}
          />
        ))}
      {showGuides &&
        grid.guides.map((g, i) =>
          g.axis === 'v' ? (
            <line key={i} x1={g.pos} y1={0} x2={g.pos} y2={1} stroke="var(--steel)" strokeWidth={0.0012} />
          ) : (
            <line key={i} x1={0} y1={g.pos} x2={1} y2={g.pos} stroke="var(--steel)" strokeWidth={0.0012} />
          ),
        )}
    </svg>
  )
}
