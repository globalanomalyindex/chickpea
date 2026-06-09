import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../grid/prng'
import { sampleGenome, genomeToPalette, mutateGenome, apportionModes } from './generator'
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
    expect(m.modeWeights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    const pal = genomeToPalette(m, 6, rng)
    expect(pal.length).toBe(6)
  })

  it('apportionModes spreads weighted shares across the ladder (largest remainder, interleaved)', () => {
    const order = apportionModes([0.6, 0.4], 5)
    expect(order.length).toBe(5)
    expect(order.filter((m) => m === 0).length).toBe(3)
    expect(order.filter((m) => m === 1).length).toBe(2)
    // the minority family is interspersed, not pooled at one end
    expect(new Set(order.slice(0, 3))).toContain(1)
  })

  it('a ramp genome travels hue monotonically with lightness (nature\'s gradients)', () => {
    const rng = mulberry32(7)
    const g = sampleGenome(rng)
    const ramp = { ...g, hueDrift: 120, modeCenters: [200], modeWeights: [1], modeKappaMul: [1] }
    const pal = genomeToPalette(ramp, 6, rng)
    let signed = 0
    for (let i = 1; i < pal.length; i++) signed += ((pal[i].H - pal[i - 1].H + 540) % 360) - 180
    expect(Math.abs(signed)).toBeGreaterThan(80) // ~120° of travel, jitter allowed
  })

  it('an atmospheric cast keeps every color inside its gamut headroom', () => {
    const rng = mulberry32(11)
    const g = sampleGenome(rng)
    const casted = { ...g, castA: 0.018, castB: -0.015 }
    for (const c of genomeToPalette(casted, 8, rng)) {
      expect(c.C).toBeLessThanOrEqual(maxChroma(c.L, c.H) + 1e-6)
    }
  })
})
