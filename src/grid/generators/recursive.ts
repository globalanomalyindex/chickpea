import { mulberry32, pick, type Rng } from '../prng'
import type { Grid, Guide, Module, RecursiveParams } from '../types'
import { largestIndex } from './_subdivide'

export const defaultRecursiveParams: RecursiveParams = {
  kind: 'recursive',
  targetModules: 9,
  splitRatios: [0.5, 0.382, 0.618],
  vBias: 0.5,
}

export function generateRecursive(seed: number, params: RecursiveParams): Grid {
  const rng: Rng = mulberry32(seed)
  const modules: Module[] = [{ x: 0, y: 0, w: 1, h: 1 }]
  const guides: Guide[] = []

  while (modules.length < params.targetModules) {
    const idx = largestIndex(modules)
    const m = modules[idx]
    const vertical = rng() < params.vBias
    const r = pick(rng, params.splitRatios)
    let a: Module
    let b: Module
    if (vertical) {
      const cut = m.x + m.w * r
      guides.push({ axis: 'v', pos: cut })
      a = { x: m.x, y: m.y, w: m.w * r, h: m.h }
      b = { x: cut, y: m.y, w: m.w * (1 - r), h: m.h }
    } else {
      const cut = m.y + m.h * r
      guides.push({ axis: 'h', pos: cut })
      a = { x: m.x, y: m.y, w: m.w, h: m.h * r }
      b = { x: m.x, y: cut, w: m.w, h: m.h * (1 - r) }
    }
    modules.splice(idx, 1, a, b)
  }

  return {
    id: `recursive-${seed}`,
    seed,
    generator: 'recursive',
    params,
    aspect: 1,
    guides,
    modules,
    ratios: [{ name: 'φ', value: 1.618 }],
    meta: { strategy: 'area-weighted subdivision' },
  }
}
