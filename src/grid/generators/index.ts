import { mulberry32, randInt } from '../prng'
import type { GeneratorKind, Grid } from '../types'
import { generateRecursive, defaultRecursiveParams } from './recursive'
import { generateModular, randomModularParams } from './modular'
import { generateNature, defaultNatureParams } from './nature'

export const GENERATOR_KINDS: GeneratorKind[] = ['recursive', 'modular', 'nature']

/** Generate a grid from a kind + seed, choosing randomized-but-valid params from the seed. */
export function generate(kind: GeneratorKind, seed: number): Grid {
  const rng = mulberry32(seed ^ 0x9e3779b9) // decorrelate param-rng from generator-rng
  switch (kind) {
    case 'recursive':
      return generateRecursive(seed, { ...defaultRecursiveParams, targetModules: randInt(rng, 5, 14) })
    case 'modular':
      return generateModular(seed, randomModularParams(rng))
    case 'nature':
      return generateNature(seed, { ...defaultNatureParams, depth: randInt(rng, 4, 8) })
  }
}
