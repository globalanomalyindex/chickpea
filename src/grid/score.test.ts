import { describe, it, expect } from 'vitest'
import type { Grid, Module } from './types'
import type { CutRef } from './tree'
import { scoreGrid } from './score'
import { mulberry32 } from './prng'
import { sampleGenome, genomeToGrid } from './genome'

/** Assemble a minimal Grid (modules + parallel cut refs) for scoring. */
function makeGrid(modules: Module[], cuts: CutRef[]): Grid {
  return {
    id: 'test',
    seed: 0,
    generator: 'recursive',
    params: { kind: 'recursive', targetModules: modules.length, splitRatios: [0.5], vBias: 0.5 },
    aspect: 1,
    guides: cuts.map((c) => ({ axis: c.axis, pos: c.pos })),
    modules,
    ratios: [],
    meta: { cuts },
  }
}

/** An aligned C×R lattice; pass per-line jitter to wobble it off its ratios. */
function lattice(C: number, R: number, jx: number[] = [], jy: number[] = []): Grid {
  const xpos = Array.from({ length: C - 1 }, (_, i) => (i + 1) / C + (jx[i] ?? 0))
  const ypos = Array.from({ length: R - 1 }, (_, i) => (i + 1) / R + (jy[i] ?? 0))
  const xs = [0, ...xpos, 1]
  const ys = [0, ...ypos, 1]
  const modules: Module[] = []
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) modules.push({ x: xs[c], y: ys[r], w: xs[c + 1] - xs[c], h: ys[r + 1] - ys[r] })
  const cuts: CutRef[] = [
    ...xpos.map((p) => ({ axis: 'v' as const, pos: p, frac: p, lo: 0, hi: 1, depth: 0 })),
    ...ypos.map((p) => ({ axis: 'h' as const, pos: p, frac: p, lo: 0, hi: 1, depth: 0 })),
  ]
  return makeGrid(modules, cuts)
}

describe('scoreGrid — beauty as a property of the output', () => {
  it('a clean 4×4 lattice scores well (crisp road)', () => {
    expect(scoreGrid(lattice(4, 4)).total).toBeGreaterThan(0.6)
  })

  it('a clean asymmetric golden recursion scores well (hierarchy road)', () => {
    // φ-subdivided: a dominant block + supporting + accent, all square-ish, on coherent golden cuts.
    const modules: Module[] = [
      { x: 0, y: 0, w: 0.618, h: 1 },
      { x: 0.618, y: 0, w: 0.382, h: 0.618 },
      { x: 0.618, y: 0.618, w: 0.382, h: 0.382 },
    ]
    const cuts: CutRef[] = [
      { axis: 'v', pos: 0.618, frac: 0.618, lo: 0, hi: 1, depth: 0 },
      { axis: 'h', pos: 0.618, frac: 0.618, lo: 0, hi: 1, depth: 1 },
    ]
    const s = scoreGrid(makeGrid(modules, cuts))
    expect(s.hierarchy).toBeGreaterThan(0.3)
    expect(s.total).toBeGreaterThan(0.55)
  })

  describe('rejects the named duds — each loses on ≥2 orthogonal terms (anti-collusion)', () => {
    it('sliver-fest (20 thin ribbons)', () => {
      const s = scoreGrid(lattice(20, 1))
      expect(s.total).toBeLessThan(0.45)
      expect(s.aspectQuality).toBeLessThan(0.1) // ribbons are degenerate aspects
      expect(s.hierarchy).toBeLessThan(0.1) // no dominant module; all 20 cells are equal slivers
    })

    it('near-dupe wobble (4×4 with every line nudged 2–3%)', () => {
      const s = scoreGrid(lattice(4, 4, [0.02, -0.025, 0.03], [-0.02, 0.025, -0.03]))
      const clean = scoreGrid(lattice(4, 4)).total
      expect(s.total).toBeLessThan(clean - 0.1) // strictly worse than the crisp version
      expect(s.ratioCoherence).toBeLessThan(0.4) // cuts no longer snap
      expect(s.whitespaceRhythm).toBeLessThan(0.8) // neither crisp nor rhythmic — the muddy middle
    })

    it('one-giant-cell-plus-slivers', () => {
      const modules: Module[] = [{ x: 0, y: 0, w: 0.82, h: 1 }]
      const N = 16
      const cuts: CutRef[] = [{ axis: 'v', pos: 0.82, frac: 0.82, lo: 0, hi: 1, depth: 0 }]
      for (let i = 0; i < N; i++) {
        modules.push({ x: 0.82, y: i / N, w: 0.18, h: 1 / N })
        if (i > 0) cuts.push({ axis: 'h', pos: i / N, frac: i / N, lo: 0, hi: 1, depth: 1 })
      }
      const s = scoreGrid(makeGrid(modules, cuts))
      expect(s.total).toBeLessThan(0.45)
      expect(s.whitespaceRhythm).toBeLessThan(0.2) // wild area spread, neither road
      expect(s.hierarchy).toBeLessThan(0.35) // giant-cell damp fires
    })
  })

  it('is deterministic', () => {
    const g = lattice(3, 5)
    expect(scoreGrid(g)).toEqual(scoreGrid(g))
  })

  it('real generated grids score in (0,1]; the raw-draw mean is mediocre (selection then lifts it)', () => {
    let sum = 0
    const N = 60
    for (let seed = 0; seed < N; seed++) {
      const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
      const grid = genomeToGrid(sampleGenome(rng), seed, rng)
      const t = scoreGrid(grid).total
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThanOrEqual(1)
      sum += t
    }
    // raw draws average mediocre — the engine's population + hill-climb is what guarantees beauty
    expect(sum / N).toBeGreaterThan(0.35)
  })
})
