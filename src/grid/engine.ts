/**
 * Grid engine — turns (seed, dials) into a finished, always-perfect, always-beautiful grid.
 *
 * There are no named kinds and no templates. A grid is SEARCHED for, exactly like the palette: the
 * selector samples a population of procedural genomes (genome.ts), scores each (score.ts), keeps the
 * best, then hill-climbs the champion (mutate → re-render → keep if better) with decaying amplitude.
 * Only the champion is emitted, so the output always clears the quality bar — and the search is what
 * makes each generation feel iteratively considered rather than random.
 *
 * Unlike the palette there is NO harmonizer pass: every grid invariant is STRUCTURAL. Perfect tiling
 * and in-bounds come from the slice-tree (tree.ts); the MIN_CELL floor in the renderer guarantees a
 * minimum module area of ~0.002 (= 0.045²), so there is never a splinter to merge and never a guide
 * off its edges. The champion is already final. Deterministic for (seed, quantized dials).
 */

import { mulberry32, type Rng } from './prng'
import { lerp } from '../palette/sampling'
import type { Grid } from './types'
import { sampleGenome, mutateGenome, genomeToGrid, DEFAULT_DIALS, type Dials, type GridGenome } from './genome'
import { scoreGrid } from './score'

export { DEFAULT_DIALS, type Dials } from './genome'

const POPULATION = 30 // candidate genomes sampled per generation
const CLIMB_STEPS = 20 // hill-climb refinements of the champion
const DIAL_STEP = 0.05 // dials are quantized once so on-screen == shared-URL reproduction

/** Snap dials to the reproduction grid. Done once, before BOTH render and URL-encode. */
export function quantizeDials(d: Dials): Dials {
  const q = (x: number): number => Math.round((x < 0 ? 0 : x > 1 ? 1 : x) / DIAL_STEP) * DIAL_STEP
  return { complexity: q(d.complexity), tension: q(d.tension), rhythm: q(d.rhythm) }
}

/** Search a population of genomes + hill-climb the champion; return the best Grid for (seed, dials). */
function selectBestGrid(rng: Rng, seed: number, dials: Dials): Grid {
  let best: Grid | null = null
  let bestGenome: GridGenome | null = null
  let bestScore = -Infinity

  for (let i = 0; i < POPULATION; i++) {
    const g = sampleGenome(rng, dials)
    const grid = genomeToGrid(g, seed, rng)
    const s = scoreGrid(grid, dials).total
    if (s > bestScore) {
      bestScore = s
      best = grid
      bestGenome = g
    }
  }
  // hill-climb: nudge the champion's genome; keep any improvement. Amplitude decays for fine-tuning.
  for (let i = 0; i < CLIMB_STEPS && bestGenome; i++) {
    const amt = lerp(0.9, 0.3, i / Math.max(1, CLIMB_STEPS - 1))
    const g = mutateGenome(bestGenome, rng, amt)
    const grid = genomeToGrid(g, seed, rng)
    const s = scoreGrid(grid, dials).total
    if (s > bestScore) {
      bestScore = s
      best = grid
      bestGenome = g
    }
  }
  return best as Grid
}

/** Public entry: a finished, quality-selected grid for (seed, dials). Pure and deterministic. */
export function generateGrid(seed: number, dials: Dials = DEFAULT_DIALS): Grid {
  const q = quantizeDials(dials)
  const rng: Rng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  return selectBestGrid(rng, seed, q)
}
