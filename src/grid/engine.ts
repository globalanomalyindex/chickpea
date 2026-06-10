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
const ELITES = 3 // distinct champions that each get their own hill-climb (separate basins)
const CLIMB_STEPS = 12 // hill-climb refinements per elite
const DIAL_STEP = 0.05 // dials are quantized once so on-screen == shared-URL reproduction

/** Snap dials to the reproduction grid. Done once, before BOTH render and URL-encode. */
export function quantizeDials(d: Dials): Dials {
  const q = (x: number): number => Math.round((x < 0 ? 0 : x > 1 ? 1 : x) / DIAL_STEP) * DIAL_STEP
  return { complexity: q(d.complexity), tension: q(d.tension), rhythm: q(d.rhythm) }
}

/** Search a population of genomes, then hill-climb the top ELITES independently and keep the global
 * winner. The third elite slot is genre-aware: when the population holds a coordinated-strategy
 * candidate (spiral / echo / mirror), its best one gets a climb even if it isn't top-3 by raw
 * score — winner-take-all otherwise discards the rare structural genres before refinement can help.
 * The bar never lowers: a special still has to out-score everyone AFTER its climb to win. */
function selectBestGrid(rng: Rng, seed: number, dials: Dials): Grid {
  interface Cand {
    g: GridGenome
    grid: Grid
    s: number
  }
  const pop: Cand[] = []
  for (let i = 0; i < POPULATION; i++) {
    const g = sampleGenome(rng, dials)
    const grid = genomeToGrid(g, seed, rng)
    pop.push({ g, grid, s: scoreGrid(grid, dials).total })
  }
  pop.sort((a, b) => b.s - a.s)
  const elites: Cand[] = pop.slice(0, 2)
  // the genre slot is earned, not free: a special must already be within striking distance of the
  // leaders to get its climb (an unconditional slot let spirals win ~5× their genome share)
  const isSpecial = (c: Cand): boolean => c.g.program.some((s) => s === 'spiral' || s === 'echo' || s === 'mirror')
  const special = pop.find(isSpecial)
  if (special && !elites.includes(special) && special.s > pop[1].s - 0.035) elites.push(special)
  else if (pop[2]) elites.push(pop[2])

  let best = pop[0]
  for (let e = 0; e < Math.min(ELITES, elites.length); e++) {
    let cur = elites[e]
    // amplitude decays for fine-tuning; keep any improvement
    for (let i = 0; i < CLIMB_STEPS; i++) {
      const amt = lerp(0.9, 0.3, i / Math.max(1, CLIMB_STEPS - 1))
      const g = mutateGenome(cur.g, rng, amt)
      const grid = genomeToGrid(g, seed, rng)
      const s = scoreGrid(grid, dials).total
      if (s > cur.s) cur = { g, grid, s }
    }
    if (cur.s > best.s) best = cur
  }
  return best.grid
}

/** Public entry: a finished, quality-selected grid for (seed, dials). Pure and deterministic. */
export function generateGrid(seed: number, dials: Dials = DEFAULT_DIALS): Grid {
  const q = quantizeDials(dials)
  const rng: Rng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  return selectBestGrid(rng, seed, q)
}
