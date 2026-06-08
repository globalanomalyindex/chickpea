import { randInt, type Rng } from '../prng'
import type { Grid, Guide, Module, ModularParams } from '../types'

export const defaultModularParams: ModularParams = {
  kind: 'modular',
  columns: 6,
  rows: 4,
  margin: 0.06,
  gutter: 0.02,
}

export function randomModularParams(rng: Rng): ModularParams {
  return {
    kind: 'modular',
    columns: randInt(rng, 2, 12),
    rows: randInt(rng, 2, 10),
    margin: 0.04 + rng() * 0.06,
    gutter: 0.01 + rng() * 0.03,
  }
}

export function generateModular(seed: number, params: ModularParams): Grid {
  const { columns: C, rows: R, margin, gutter } = params
  const usableW = 1 - 2 * margin
  const usableH = 1 - 2 * margin
  const colW = (usableW - (C - 1) * gutter) / C
  const rowH = (usableH - (R - 1) * gutter) / R

  // Interior guides sit on each column's right edge (the start of its trailing gutter);
  // the c===0 and c===C guides are the left/right content margins.
  const guides: Guide[] = []
  for (let c = 0; c <= C; c++) guides.push({ axis: 'v', pos: margin + c * (colW + gutter) - (c > 0 ? gutter : 0) })
  for (let r = 0; r <= R; r++) guides.push({ axis: 'h', pos: margin + r * (rowH + gutter) - (r > 0 ? gutter : 0) })

  const modules: Module[] = []
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      modules.push({
        x: margin + c * (colW + gutter),
        y: margin + r * (rowH + gutter),
        w: colW,
        h: rowH,
      })
    }
  }

  return {
    id: `modular-${seed}`,
    seed,
    generator: 'modular',
    params,
    aspect: 1,
    guides,
    modules,
    ratios: [{ name: 'module', value: colW / rowH }],
    meta: { columns: C, rows: R },
  }
}
