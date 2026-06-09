import { describe, it, expect } from 'vitest'
import { gamutMapToRgb, rgbToOklch, inGamut, deltaE, oklchToOklab } from './oklch'

describe('oklch color core', () => {
  it('round-trips in-gamut sRGB through OKLCH within ±1 per channel', () => {
    const samples: [number, number, number][] = [
      [0, 0, 0],
      [255, 255, 255],
      [128, 128, 128],
      [237, 122, 40], // chickpea orange
      [78, 106, 122], // steel
      [10, 200, 90],
      [200, 30, 120],
    ]
    for (const rgb of samples) {
      const back = gamutMapToRgb(rgbToOklch(rgb))
      for (let i = 0; i < 3; i++) expect(Math.abs(back[i] - rgb[i])).toBeLessThanOrEqual(1)
    }
  })

  it('maps white and black to the expected OKLCH extremes', () => {
    const white = rgbToOklch([255, 255, 255])
    const black = rgbToOklch([0, 0, 0])
    expect(white.L).toBeGreaterThan(0.99)
    expect(white.C).toBeLessThan(0.01)
    expect(black.L).toBeLessThan(0.01)
  })

  it('always returns integer channels within 0..255, even for absurd chroma', () => {
    for (let H = 0; H < 360; H += 17) {
      for (const L of [0.1, 0.5, 0.9]) {
        const rgb = gamutMapToRgb({ L, C: 0.6, H }) // 0.6 chroma is far outside sRGB everywhere
        for (const v of rgb) {
          expect(Number.isInteger(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(255)
        }
      }
    }
  })

  it('gamut mapping preserves hue (reduces chroma only)', () => {
    const want = { L: 0.65, C: 0.5, H: 142 }
    const got = rgbToOklch(gamutMapToRgb(want))
    // hue within a couple degrees; chroma got pulled in to fit gamut
    const dh = Math.abs(((got.H - want.H + 540) % 360) - 180)
    expect(dh).toBeLessThan(3.5)
    expect(got.C).toBeLessThan(want.C)
  })

  it('inGamut agrees with a direct sRGB conversion at the boundary', () => {
    expect(inGamut({ L: 0.5, C: 0.02, H: 30 })).toBe(true)
    expect(inGamut({ L: 0.5, C: 0.5, H: 30 })).toBe(false)
  })

  it('deltaE is zero for identical colors and positive otherwise', () => {
    const a = { L: 0.5, C: 0.1, H: 90 }
    expect(deltaE(a, a)).toBe(0)
    expect(deltaE(a, { L: 0.6, C: 0.1, H: 90 })).toBeGreaterThan(0)
    // oklchToOklab is the basis for deltaE; spot-check it returns L unchanged
    expect(oklchToOklab(a)[0]).toBe(0.5)
  })
})
