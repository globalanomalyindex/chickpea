import { useMemo, useState } from 'react'
import { generateRecursive, defaultRecursiveParams } from '../../grid/generators/recursive'
import { GridSvg } from '../../components/GridSvg'
import { Figure, FigureSlider, FigureReadouts } from '../Figure'
import { SquareStage } from './SquareStage'

const SEED = 7

/**
 * Recursive subdivision, live. Drag targetModules and watch the area-weighted splitter
 * keep adding cells while the tiling stays gap-free and overlap-free — the same pure
 * `generateRecursive` the studio ships, at a fixed seed so the figure is deterministic.
 */
export function SubdivisionFigure() {
  const [target, setTarget] = useState(9)

  const grid = useMemo(
    () => generateRecursive(SEED, { ...defaultRecursiveParams, targetModules: target }),
    [target],
  )

  return (
    <Figure
      index="01"
      title="recursive subdivision"
      caption="start with the whole canvas as one cell; repeatedly pick the largest cell and split it at a ratio position (½, or the golden 0.382 / 0.618). every split replaces one rectangle with two that exactly fill it, so however far you push the count, the tiling never gaps or overlaps. that invariant is enforced in tests, not hoped for."
    >
      <FigureSlider
        label="target cells"
        value={target}
        min={2}
        max={24}
        onChange={setTarget}
      />
      <SquareStage>{(size) => <GridSvg grid={grid} size={size} />}</SquareStage>
      <FigureReadouts
        items={[
          { k: 'modules', v: String(grid.modules.length) },
          { k: 'guides', v: String(grid.guides.length) },
          { k: 'seed', v: String(SEED) },
        ]}
      />
    </Figure>
  )
}
