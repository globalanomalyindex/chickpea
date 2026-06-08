import { describe, it, expect } from 'vitest'
import { hslToRgb, rgbToHex, rgbToHsl } from './hsl'

describe('hslToRgb', () => {
  it('maps known colors', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0])
    expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0])
    expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0])
    expect(hslToRgb(0, 0, 1)).toEqual([255, 255, 255])
  })
})

describe('rgbToHex', () => {
  it('formats lowercase 6-digit hex', () => {
    expect(rgbToHex([255, 0, 0])).toBe('#ff0000')
    expect(rgbToHex([78, 106, 122])).toBe('#4e6a7a')
  })
})

describe('rgbToHsl', () => {
  it('maps known colors', () => {
    const [hr, sr, lr] = rgbToHsl([255, 0, 0])
    expect(hr).toBeCloseTo(0, 4)
    expect(sr).toBeCloseTo(1, 4)
    expect(lr).toBeCloseTo(0.5, 4)
    const [hg, , lg] = rgbToHsl([0, 255, 0])
    expect(hg).toBeCloseTo(120, 4)
    expect(lg).toBeCloseTo(0.5, 4)
    expect(rgbToHsl([0, 0, 0])).toEqual([0, 0, 0])
    expect(rgbToHsl([255, 255, 255])[2]).toBeCloseTo(1, 4)
  })
  it('round-trips through hslToRgb', () => {
    for (const rgb of [[78, 106, 122], [200, 40, 90], [12, 180, 60]] as [number, number, number][]) {
      const [h, s, l] = rgbToHsl(rgb)
      expect(hslToRgb(h, s, l)).toEqual(rgb)
    }
  })
})
