import { mulberry32, type Rng } from '../prng'
import type { Grid, Guide, Module, NatureParams } from '../types'
import { largestIndex } from './_subdivide'

const INV_PHI = 0.6180339887 // 1/φ

export const defaultNatureParams: NatureParams = {
  kind: 'nature',
  depth: 6,
}

export function generateNature(seed: number, params: NatureParams): Grid {
  const rng: Rng = mulberry32(seed)
  const modules: Module[] = [{ x: 0, y: 0, w: 1, h: 1 }]
  const guides: Guide[] = []
  let vertical = rng() < 0.5 // first axis chosen by seed; alternates thereafter

  for (let i = 0; i < params.depth; i++) {
    const idx = largestIndex(modules)
    const m = modules[idx]
    // golden cut: place the larger part on a seed-chosen side
    const bigFirst = rng() < 0.5
    const r = bigFirst ? INV_PHI : 1 - INV_PHI
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
    vertical = !vertical
  }

  return {
    id: `nature-${seed}`,
    seed,
    generator: 'nature',
    params,
    aspect: 1,
    guides,
    modules,
    ratios: [{ name: 'φ', value: 1.6180339887 }],
    meta: { strategy: 'golden-section whirling subdivision' },
  }
}
