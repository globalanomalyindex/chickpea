import { describe, it, expect } from 'vitest'
import { encodeDescriptor, decodeDescriptor } from './serialize'

describe('descriptor serialization', () => {
  it('round-trips dials + seed + color count', () => {
    const params = new URLSearchParams()
    encodeDescriptor({ complexity: 0.7, tension: 0.25, rhythm: 0.9, seed: 4242, count: 8 }, params)
    expect(params.get('cx')).toBe('0.70')
    expect(params.get('tn')).toBe('0.25')
    expect(params.get('rh')).toBe('0.90')
    expect(params.get('s')).toBe('4242')
    expect(params.get('n')).toBe('8')
    expect(decodeDescriptor(params)).toEqual({ complexity: 0.7, tension: 0.25, rhythm: 0.9, seed: 4242, count: 8 })
  })

  it('falls back to defaults for missing/invalid input', () => {
    expect(decodeDescriptor(new URLSearchParams())).toEqual({ complexity: 0.5, tension: 0.5, rhythm: 0.5, seed: 1, count: 6 })
    expect(decodeDescriptor(new URLSearchParams('cx=x&s=y'))).toEqual({ complexity: 0.5, tension: 0.5, rhythm: 0.5, seed: 1, count: 6 })
  })

  it('clamps dials to 0..1 and count to 2..12', () => {
    const d = decodeDescriptor(new URLSearchParams('cx=2&tn=-1&rh=0.4&s=2&n=99'))
    expect(d.complexity).toBe(1)
    expect(d.tension).toBe(0)
    expect(d.rhythm).toBe(0.4)
    expect(d.count).toBe(12)
    expect(decodeDescriptor(new URLSearchParams('s=2&n=1')).count).toBe(2)
  })
})
