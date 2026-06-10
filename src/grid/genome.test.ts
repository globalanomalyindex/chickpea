import { describe, it, expect } from 'vitest'
import { mulberry32 } from './prng'
import { checkBounds, checkTiling, checkCrispGuides } from './invariants'
import { sampleGenome, mutateGenome, genomeToGrid, DEFAULT_DIALS, type Dials } from './genome'

const DIAL_CORNERS: Dials[] = []
for (const complexity of [0, 0.5, 1]) {
  for (const tension of [0, 0.5, 1]) {
    for (const rhythm of [0, 0.5, 1]) DIAL_CORNERS.push({ complexity, tension, rhythm })
  }
}

function build(seed: number, dials: Dials = DEFAULT_DIALS) {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  const g = sampleGenome(rng, dials)
  return genomeToGrid(g, seed, rng)
}

describe('genomeToGrid — perfect tiling by construction', () => {
  it('every grid tiles the unit square (zero gap, disjoint, area 1) across seeds × dial corners', () => {
    for (const dials of DIAL_CORNERS) {
      for (let seed = 0; seed < 120; seed++) {
        const grid = build(seed * 7 + 1, dials)
        expect(checkBounds(grid.modules, 1e-9)).toBe(true)
        const t = checkTiling(grid.modules, 1e-9)
        expect(t.covered).toBe(true)
        expect(t.disjoint).toBe(true)
      }
    }
  })

  it('every guide lies bit-exactly on a module edge (crisp guides)', () => {
    for (const dials of DIAL_CORNERS) {
      for (let seed = 0; seed < 60; seed++) {
        expect(checkCrispGuides(build(seed * 13 + 2, dials))).toBe(true)
      }
    }
  })

  it('respects the structural floor: no module thinner than ~MIN_CELL on either axis', () => {
    for (let seed = 0; seed < 200; seed++) {
      const grid = build(seed * 5 + 3)
      for (const m of grid.modules) {
        expect(m.w).toBeGreaterThan(0.02)
        expect(m.h).toBeGreaterThan(0.02)
      }
    }
  })

  it('emits at least 2 modules and respects the target count loosely', () => {
    for (let seed = 0; seed < 80; seed++) {
      const grid = build(seed * 11 + 4)
      expect(grid.modules.length).toBeGreaterThanOrEqual(2)
      expect(grid.modules.length).toBeLessThanOrEqual(40)
    }
  })

  it('is deterministic for a (seed, dials) pair', () => {
    expect(build(42)).toEqual(build(42))
    expect(build(42, { complexity: 0.8, tension: 0.2, rhythm: 0.9 })).toEqual(
      build(42, { complexity: 0.8, tension: 0.2, rhythm: 0.9 }),
    )
  })

  it('mutated genomes still render perfect tilings', () => {
    for (let seed = 0; seed < 120; seed++) {
      const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
      let g = sampleGenome(rng)
      for (let s = 0; s < 6; s++) g = mutateGenome(g, rng, 0.7)
      const grid = genomeToGrid(g, seed, rng)
      expect(checkBounds(grid.modules, 1e-9)).toBe(true)
      expect(checkTiling(grid.modules, 1e-9).covered).toBe(true)
      expect(checkCrispGuides(grid)).toBe(true)
    }
  })

  it('ratio labels are truthful (named ratios denote their value)', () => {
    for (let seed = 0; seed < 60; seed++) {
      const grid = build(seed * 17 + 5)
      for (const r of grid.ratios) {
        expect(Number.isFinite(r.value)).toBe(true)
        // a named position ratio must equal its value; aspect entries (w:h or named) are >= 1
        if (r.name === '½') expect(r.value).toBeCloseTo(0.5, 6)
        if (r.name === '1/φ') expect(r.value).toBeCloseTo(0.618, 3)
        if (r.name === '⅓') expect(r.value).toBeCloseTo(1 / 3, 6)
      }
    }
  })

  it('Complexity dial raises mean module count; each fixed dial still varies', () => {
    const meanCount = (cx: number) => {
      let total = 0
      const counts: number[] = []
      for (let seed = 0; seed < 60; seed++) {
        const n = build(seed * 3 + 1, { complexity: cx, tension: 0.5, rhythm: 0.5 }).modules.length
        total += n
        counts.push(n)
      }
      const mean = total / 60
      const variance = counts.reduce((s, n) => s + (n - mean) ** 2, 0) / 60
      return { mean, variance }
    }
    const low = meanCount(0.1)
    const high = meanCount(0.9)
    expect(high.mean).toBeGreaterThan(low.mean + 2) // dial bites
    expect(high.variance).toBeGreaterThan(1) // still varied at a fixed dial
  })
})

describe('construction programs (ordered developmental stages)', () => {
  type Stage = 'grow' | 'lattice' | 'spiral' | 'echo' | 'mirror'
  const force = (seed: number, program: Stage[]) => {
    const rng = mulberry32(seed)
    const g = { ...sampleGenome(rng), program, targetLeaves: 12 }
    return genomeToGrid(g, seed, rng)
  }

  it('a spiral whirl is a valid tiling with crisp guides and a coherent ratio readout', () => {
    for (const seed of [3, 11, 27, 64]) {
      const g = force(seed, ['spiral'])
      expect(checkBounds(g.modules, 1e-9)).toBe(true)
      expect(checkTiling(g.modules, 1e-9).covered).toBe(true)
      expect(checkCrispGuides(g)).toBe(true)
      expect(g.modules.length).toBeGreaterThanOrEqual(5)
      expect(g.meta?.strategy).toBe('spiral whirl')
    }
  })

  it('an echo cascade is a valid tiling with crisp guides', () => {
    for (const seed of [5, 19, 42]) {
      const g = force(seed, ['echo'])
      expect(checkBounds(g.modules, 1e-9)).toBe(true)
      expect(checkTiling(g.modules, 1e-9).covered).toBe(true)
      expect(checkCrispGuides(g)).toBe(true)
    }
  })

  it('a grow → mirror program produces true bilateral symmetry: every module has its exact reflection', () => {
    for (const seed of [7, 23, 55]) {
      const g = force(seed, ['grow', 'mirror'])
      expect(checkBounds(g.modules, 1e-9)).toBe(true)
      expect(checkTiling(g.modules, 1e-9).covered).toBe(true)
      expect(checkCrispGuides(g)).toBe(true)
      const genome = g.meta?.genome as { mirrorAxis: 'v' | 'h' }
      const axis = genome.mirrorAxis
      for (const m of g.modules) {
        const rx = axis === 'v' ? 1 - m.x - m.w : m.x
        const ry = axis === 'h' ? 1 - m.y - m.h : m.y
        const hit = g.modules.some(
          (o) => Math.abs(o.x - rx) < 1e-9 && Math.abs(o.y - ry) < 1e-9 && Math.abs(o.w - m.w) < 1e-9 && Math.abs(o.h - m.h) < 1e-9,
        )
        expect(hit).toBe(true)
      }
    }
  })

  it('order matters: the same stages in a different order build a different composition', () => {
    const a = force(9, ['lattice', 'echo'])
    const b = force(9, ['echo', 'lattice'])
    expect(a.modules).not.toEqual(b.modules)
    for (const g of [a, b]) {
      expect(checkTiling(g.modules, 1e-9).covered).toBe(true)
      expect(checkCrispGuides(g)).toBe(true)
    }
    expect(a.meta?.strategy).toBe('lattice → echo')
    expect(b.meta?.strategy).toBe('echo → lattice')
  })

  it('chained programs (incl. double mirror = quadrant symmetry) stay valid tilings', () => {
    const programs: Stage[][] = [
      ['spiral', 'mirror'],
      ['grow', 'mirror', 'spiral'],
      ['lattice', 'mirror', 'mirror'],
      ['grow', 'lattice', 'echo', 'mirror'],
    ]
    for (const program of programs) {
      for (const seed of [2, 31]) {
        const g = force(seed, program)
        expect(checkBounds(g.modules, 1e-9)).toBe(true)
        const t = checkTiling(g.modules, 1e-9)
        expect(t.covered).toBe(true)
        expect(t.disjoint).toBe(true)
        expect(checkCrispGuides(g)).toBe(true)
      }
    }
  })
})
