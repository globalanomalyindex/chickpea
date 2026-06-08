import { describe, it, expect } from 'vitest'
import { hslToRgb, rgbToHex } from './hsl'

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
