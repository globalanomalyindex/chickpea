import { describe, it, expect } from 'vitest'
import { encodeDescriptor, decodeDescriptor } from './serialize'

describe('descriptor serialization', () => {
  it('round-trips dials + seed + color count', () => {
    const params = new URLSearchParams()
    encodeDescriptor({ complexity: 0.7, tension: 0.25, rhythm: 0.9, seed: '4242', count: 8 }, params)
    expect(params.get('cx')).toBe('0.70')
    expect(params.get('tn')).toBe('0.25')
    expect(params.get('rh')).toBe('0.90')
    expect(params.get('s')).toBe('4242')
    expect(params.get('n')).toBe('8')
    expect(decodeDescriptor(params)).toEqual({ complexity: 0.7, tension: 0.25, rhythm: 0.9, seed: '4242', count: 8 })
  })

  it('round-trips a text seed (minecraft-style: words, phrases, symbols)', () => {
    const params = new URLSearchParams()
    encodeDescriptor({ complexity: 0.5, tension: 0.5, rhythm: 0.5, seed: 'sunflower~3', count: 6 }, params)
    expect(params.get('s')).toBe('sunflower~3')
    expect(decodeDescriptor(params).seed).toBe('sunflower~3')
  })

  it('falls back to defaults for missing input (seed defaults to "1")', () => {
    expect(decodeDescriptor(new URLSearchParams())).toEqual({ complexity: 0.5, tension: 0.5, rhythm: 0.5, seed: '1', count: 6 })
    // an arbitrary seed string is valid (only the dials/count are sanitized)
    expect(decodeDescriptor(new URLSearchParams('cx=x&s=y'))).toEqual({ complexity: 0.5, tension: 0.5, rhythm: 0.5, seed: 'y', count: 6 })
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
