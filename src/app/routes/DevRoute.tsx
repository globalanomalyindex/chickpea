import { useState } from 'react'
import { generate, GENERATOR_KINDS } from '../../grid/generators'
import type { GeneratorKind } from '../../grid/types'
import { GridSvg } from '../../components/GridSvg'

export function DevRoute() {
  const [kind, setKind] = useState<GeneratorKind>('recursive')
  const [seed, setSeed] = useState(1)
  const grid = generate(kind, seed)

  return (
    <main style={{ padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-mono)' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Chickpea · dev</strong>
        {GENERATOR_KINDS.map((k) => (
          <label key={k}>
            <input type="radio" checked={kind === k} onChange={() => setKind(k)} /> {k}
          </label>
        ))}
        <button onClick={() => setSeed((s) => s + 1)}>next seed ({seed})</button>
        <button onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>random seed</button>
        <code>modules: {grid.modules.length}</code>
        <code>ratios: {grid.ratios.map((r) => `${r.name}=${r.value.toFixed(3)}`).join(', ')}</code>
      </div>
      <GridSvg grid={grid} />
    </main>
  )
}
