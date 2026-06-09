import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../grid/prng'
import { sampleGenome, genomeToPalette, mutateGenome } from './generator'
import { maxChroma } from './oklch'
import { circularResultant } from './sampling'

const build = (seed: number, count: number) => {
  const rng = mulberry32(seed)
  return genomeToPalette(sampleGenome(rng), count, rng)
}

describe('procedural sampler', () => {
  it('is deterministic for a seed', () => {
    expect(build(123, 6)).toEqual(build(123, 6))
  })

  it('produces exactly count colors, gamut-safe (C within headroom), valid ranges', () => {
    for (const count of [2, 5, 8, 12]) {
      const pal = build(count * 17 + 3, count)
      expect(pal.length).toBe(count)
      for (const c of pal) {
        expect(c.L).toBeGreaterThanOrEqual(0)
        expect(c.L).toBeLessThanOrEqual(1)
        expect(c.H).toBeGreaterThanOrEqual(0)
        expect(c.H).toBeLessThan(360)
        expect(c.C).toBeGreaterThanOrEqual(0)
        // requested chroma never exceeds the in-gamut headroom (so render ≈ intent)
        expect(c.C).toBeLessThanOrEqual(maxChroma(c.L, c.H) + 1e-6)
      }
    }
  })

  it('spans the space: across seeds we see both muted and vivid palettes', () => {
    let minMeanC = Infinity
    let maxMeanC = -Infinity
    for (let s = 0; s < 200; s++) {
      const pal = build(s * 9 + 1, 6)
      const meanC = pal.reduce((a, c) => a + c.C, 0) / pal.length
      minMeanC = Math.min(minMeanC, meanC)
      maxMeanC = Math.max(maxMeanC, meanC)
    }
    expect(minMeanC).toBeLessThan(0.05) // some genuinely muted/neutral palettes
    expect(maxMeanC).toBeGreaterThan(0.13) // some genuinely vivid palettes
  })

  it('spans hue structure: both tight (mono/analogous) and wide (spread) palettes appear', () => {
    let tight = 0
    let wide = 0
    for (let s = 0; s < 200; s++) {
      const pal = build(s * 13 + 5, 6)
      const R = circularResultant(pal.map((c) => c.H))
      if (R > 0.85) tight++
      if (R < 0.4) wide++
    }
    expect(tight).toBeGreaterThan(5)
    expect(wide).toBeGreaterThan(5)
  })

  it('spans contrast: both low-contrast and high-contrast lightness ranges appear', () => {
    let lowC = 0
    let highC = 0
    for (let s = 0; s < 200; s++) {
      const pal = build(s * 7 + 2, 6)
      const Ls = pal.map((c) => c.L)
      const spread = Math.max(...Ls) - Math.min(...Ls)
      if (spread < 0.45) lowC++
      if (spread > 0.7) highC++
    }
    expect(lowC).toBeGreaterThan(3)
    expect(highC).toBeGreaterThan(3)
  })

  it('mutateGenome keeps a valid, expandable genome', () => {
    const rng = mulberry32(99)
    const g = sampleGenome(rng)
    const m = mutateGenome(g, rng, 1)
    expect(m.lHi).toBeGreaterThan(m.lLo)
    const pal = genomeToPalette(m, 6, rng)
    expect(pal.length).toBe(6)
  })
})
