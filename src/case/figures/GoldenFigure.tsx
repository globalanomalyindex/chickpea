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
 * φ-rectangle the subdivision keeps producing: the module whose long-to-short ratio is
 * closest to φ. A golden cut always leaves a φ-rectangle behind, so this reads ≈1.618 at
 * every depth ≥ 1, naming the ratio the generator actually produces.
 */
export function GoldenFigure() {
  const [depth, setDepth] = useState(6)

  const grid = useMemo(
    () => generateNature(SEED, { ...defaultNatureParams, depth }),
    [depth],
  )

  // the φ-rectangle: the module whose long/short ratio is closest to φ. A golden-section
  // subdivision always keeps one around, so this reads ≈1.618 at any depth — the φ arrow
  // names a ratio the figure can actually stand behind.
  const phiModule = useMemo(
    () =>
      grid.modules.reduce((best, c) => {
        const r = Math.max(c.w, c.h) / Math.min(c.w, c.h)
        const rb = Math.max(best.w, best.h) / Math.min(best.w, best.h)
        return Math.abs(r - PHI) < Math.abs(rb - PHI) ? c : best
      }),
    [grid],
  )
  // the φ arrow runs along the module's longer axis, centered on it, spanning exactly that
  // side — so the annotation is geometrically honest, not just decorative.
  const horizontal = phiModule.w >= phiModule.h
  const ratio = Math.max(phiModule.w, phiModule.h) / Math.min(phiModule.w, phiModule.h)

  return (
    <Figure
      index="02"
      title="Nature-math · the golden section"
      caption="Repeatedly divide the canvas at the golden point — 0.618 of the side — alternating axis each time. The guides land exactly on φ positions, and the φ-rectangle the subdivision keeps producing measures 1.618 to three places. Mathematics from growth and shells, made into a grid."
    >
      <FigureSlider label="depth" value={depth} min={1} max={10} onChange={setDepth} />
      <SquareStage>
        {(size) => (
          <div style={{ position: 'relative', width: size, height: size }}>
            <GridSvg grid={grid} size={size} />
            {/* φ arrow along the long axis of the φ-rectangle, centered on it */}
            <div
              style={{
                position: 'absolute',
                left: horizontal
                  ? phiModule.x * size
                  : (phiModule.x + phiModule.w / 2) * size - 8,
                top: horizontal
                  ? (phiModule.y + phiModule.h / 2) * size - 8
                  : phiModule.y * size,
                pointerEvents: 'none',
              }}
            >
              <DimensionArrow
                orientation={horizontal ? 'h' : 'v'}
                length={(horizontal ? phiModule.w : phiModule.h) * size}
                label="φ"
              />
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
