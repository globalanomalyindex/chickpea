import { useMemo, useState } from 'react'
import { generateModular } from '../../grid/generators/modular'
import { GridSvg } from '../../components/GridSvg'
import { Figure, FigureSlider, FigureReadouts } from '../Figure'
import { SquareStage } from './SquareStage'

const SEED = 1
const MARGIN = 0.06
const GUTTER = 0.022

/**
 * The classic Swiss modular grid, live. Columns and rows drive a clean lattice with fixed
 * margins and gutters; every module edge aligns to the declared column/row lattice exactly
 * (a separate invariant from the tiling generators). Müller-Brockmann, parameterized.
 */
export function ModularFigure() {
  const [columns, setColumns] = useState(6)
  const [rows, setRows] = useState(4)

  const grid = useMemo(
    () => generateModular(SEED, { kind: 'modular', columns, rows, margin: MARGIN, gutter: GUTTER }),
    [columns, rows],
  )

  return (
    <Figure
      index="03"
      title="swiss modular"
      caption="margins, columns, rows, gutters: the grid that built mid-century swiss design. drag the counts and the lattice rebuilds: every module snaps to the column and row tracks exactly, with no drift. order you can set by hand, generated within the rules."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FigureSlider label="columns" value={columns} min={2} max={12} onChange={setColumns} />
        <FigureSlider label="rows" value={rows} min={2} max={10} onChange={setRows} />
      </div>
      <SquareStage>{(size) => <GridSvg grid={grid} size={size} />}</SquareStage>
      <FigureReadouts
        items={[
          { k: 'modules', v: String(grid.modules.length) },
          { k: 'columns', v: String(columns) },
          { k: 'rows', v: String(rows) },
          { k: 'seed', v: String(SEED) },
        ]}
      />
    </Figure>
  )
}
