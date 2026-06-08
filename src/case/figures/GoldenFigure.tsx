import { useMemo, useState } from 'react'
import { generateNature, defaultNatureParams } from '../../grid/generators/nature'
import { GridSvg } from '../../components/GridSvg'
import { DimensionArrow } from '../../components/DimensionArrow'
import { Figure, FigureSlider, FigureReadouts } from '../Figure'
import { SquareStage } from './SquareStage'

const SEED = 12
const PHI = 1.6180339887

/**
 * The golden-section whirling subdivision, live. Each step golden-cuts the largest cell
 * and flips the axis — the whirling-squares spiral. A `φ` dimension arrow is laid over the
 * widest module to name the ratio the generator actually produced (the longer side over
 * the shorter is φ within tolerance, which the invariant suite checks).
 */
export function GoldenFigure() {
  const [depth, setDepth] = useState(6)

  const grid = useMemo(
    () => generateNature(SEED, { ...defaultNatureParams, depth }),
    [depth],
  )

  // the largest module — the φ arrow names the ratio of its long to short side.
  const largest = useMemo(
    () => grid.modules.reduce((p, c) => (c.w * c.h > p.w * p.h ? c : p)),
    [grid],
  )
  const longSide = Math.max(largest.w, largest.h)
  const ratio = Math.max(largest.w, largest.h) / Math.min(largest.w, largest.h)

  return (
    <Figure
      index="02"
      title="Nature-math · the golden section"
      caption="Repeatedly divide the canvas at the golden point — 0.618 of the side — alternating axis each time. The guides land exactly on φ positions, and the dominant module's long-to-short ratio measures φ to three places. Mathematics from growth and shells, made into a grid."
    >
      <FigureSlider label="depth" value={depth} min={1} max={10} onChange={setDepth} />
      <SquareStage>
        {(size) => (
          <div style={{ position: 'relative', width: size, height: size }}>
            <GridSvg grid={grid} size={size} />
            {/* φ arrow over the long side of the largest module */}
            <div
              style={{
                position: 'absolute',
                left: largest.x * size + (largest.w * size - longSide * size) / 2,
                top: (largest.y + largest.h / 2) * size - 8,
                pointerEvents: 'none',
              }}
            >
              <DimensionArrow orientation="h" length={longSide * size} label="φ" />
            </div>
          </div>
        )}
      </SquareStage>
      <FigureReadouts
        items={[
          { k: 'φ', v: PHI.toFixed(4) },
          { k: 'measured', v: ratio.toFixed(3) },
          { k: 'guides', v: String(grid.guides.length) },
          { k: 'seed', v: String(SEED) },
        ]}
      />
    </Figure>
  )
}
