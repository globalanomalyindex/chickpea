import { describe, it, expect } from 'vitest'
import { encodeDescriptor, decodeDescriptor } from './serialize'

describe('descriptor serialization', () => {
  it('round-trips kind + seed + palette style + count', () => {
    const params = new URLSearchParams()
    encodeDescriptor({ kind: 'nature', seed: 4242, style: 'jewel', count: 8 }, params)
    expect(params.get('g')).toBe('nature')
    expect(params.get('s')).toBe('4242')
    expect(params.get('p')).toBe('jewel')
    expect(params.get('n')).toBe('8')
    expect(decodeDescriptor(params)).toEqual({ kind: 'nature', seed: 4242, style: 'jewel', count: 8 })
  })

  it('falls back to a default for missing/invalid input', () => {
    expect(decodeDescriptor(new URLSearchParams())).toEqual({ kind: 'recursive', seed: 1, style: 'auto', count: 6 })
    expect(decodeDescriptor(new URLSearchParams('g=bogus&s=x'))).toEqual({
      kind: 'recursive',
      seed: 1,
      style: 'auto',
      count: 6,
    })
  })

  it('clamps an out-of-range count and rejects an unknown style', () => {
    expect(decodeDescriptor(new URLSearchParams('g=modular&s=2&p=zzz&n=99')).style).toBe('auto')
    expect(decodeDescriptor(new URLSearchParams('g=modular&s=2&p=neon&n=99')).count).toBe(12)
    expect(decodeDescriptor(new URLSearchParams('g=modular&s=2&p=neon&n=1')).count).toBe(2)
  })
})
