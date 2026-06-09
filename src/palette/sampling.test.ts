import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../grid/prng'
import { gaussian, vonMises, warpedLadder, circularResultant, hueGap, wrap360, sampleWeights, hueDelta } from './sampling'

describe('mixture weights (60-30-10 structure)', () => {
  it('returns positive weights summing to 1, deterministic for a seed', () => {
    const a = sampleWeights(mulberry32(5), 4, 1.8)
    const b = sampleWeights(mulberry32(5), 4, 1.8)
    expect(a).toEqual(b)
    expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9)
    for (const w of a) expect(w).toBeGreaterThan(0.02) // floor: no family silently vanishes
  })

  it('n=1 is the whole pie', () => {
    expect(sampleWeights(mulberry32(1), 1, 2)).toEqual([1])
  })

  it('dominance produces genuinely asymmetric shares across draws', () => {
    let asym = 0
    for (let s = 0; s < 60; s++) {
      const w = sampleWeights(mulberry32(s * 3 + 1), 3, 2.2)
      if (Math.max(...w) > 0.55) asym++
    }
    expect(asym).toBeGreaterThan(15)
  })
})

describe('signed hue rotation', () => {
  it('takes the short way around, signed', () => {
    expect(hueDelta(350, 10)).toBe(20)
    expect(hueDelta(10, 350)).toBe(-20)
    expect(hueDelta(40, 90)).toBe(50)
    expect(Math.abs(hueDelta(0, 180))).toBe(180)
  })
})

describe('sampling primitives', () => {
  it('gaussian is ~mean 0, ~sd 1 over many draws', () => {
    const rng = mulberry32(1)
    const N = 20000
    let s = 0
    let s2 = 0
    for (let i = 0; i < N; i++) {
      const x = gaussian(rng)
      s += x
      s2 += x * x
    }
    const mean = s / N
    const sd = Math.sqrt(s2 / N - mean * mean)
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(Math.abs(sd - 1)).toBeLessThan(0.05)
  })

  it('vonMises concentrates around mu as kappa grows', () => {
    const rng = mulberry32(7)
    const sample = (kappa: number) => {
      const hs: number[] = []
      for (let i = 0; i < 4000; i++) hs.push(vonMises(rng, 200, kappa))
      return circularResultant(hs)
    }
    const loose = sample(0.5)
    const tight = sample(20)
    expect(tight).toBeGreaterThan(loose)
    expect(tight).toBeGreaterThan(0.9) // very concentrated
  })

  it('vonMises with kappa≈0 is ~uniform on the circle', () => {
    const rng = mulberry32(3)
    const hs: number[] = []
    for (let i = 0; i < 8000; i++) hs.push(vonMises(rng, 123, 0))
    expect(circularResultant(hs)).toBeLessThan(0.05) // spread out
  })

  it('vonMises mean direction tracks mu', () => {
    const rng = mulberry32(11)
    const hs: number[] = []
    for (let i = 0; i < 6000; i++) hs.push(vonMises(rng, 40, 6))
    // circular mean
    let sx = 0
    let sy = 0
    for (const h of hs) {
      sx += Math.cos((h * Math.PI) / 180)
      sy += Math.sin((h * Math.PI) / 180)
    }
    const mean = wrap360((Math.atan2(sy, sx) * 180) / Math.PI)
    expect(hueGap(mean, 40)).toBeLessThan(6)
  })

  it('warpedLadder is ascending in [0,1], skew pushes the mass', () => {
    const even = warpedLadder(5, 0)
    expect(even[0]).toBe(0)
    expect(even[even.length - 1]).toBe(1)
    for (let i = 1; i < even.length; i++) expect(even[i]).toBeGreaterThan(even[i - 1])
    const high = warpedLadder(5, 1.5) // push toward 1 (high-key)
    const low = warpedLadder(5, -1.5) // push toward 0 (low-key)
    // the interior point sits higher when skewed high, lower when skewed low
    expect(high[2]).toBeGreaterThan(even[2])
    expect(low[2]).toBeLessThan(even[2])
  })

  it('circularResultant: identical hues → 1, opposite pair → 0', () => {
    expect(circularResultant([90, 90, 90])).toBeCloseTo(1, 5)
    expect(circularResultant([0, 180])).toBeCloseTo(0, 5)
  })

  it('hueGap is symmetric and wraps', () => {
    expect(hueGap(10, 350)).toBeCloseTo(20, 5)
    expect(hueGap(350, 10)).toBeCloseTo(20, 5)
    expect(hueGap(0, 180)).toBeCloseTo(180, 5)
  })
})
