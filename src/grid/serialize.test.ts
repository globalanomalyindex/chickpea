import { describe, it, expect } from 'vitest'
import { encodeDescriptor, decodeDescriptor } from './serialize'

describe('descriptor serialization', () => {
  it('round-trips kind + seed + color count', () => {
    const params = new URLSearchParams()
    encodeDescriptor({ kind: 'nature', seed: 4242, count: 8 }, params)
    expect(params.get('g')).toBe('nature')
    expect(params.get('s')).toBe('4242')
    expect(params.get('n')).toBe('8')
    expect(decodeDescriptor(params)).toEqual({ kind: 'nature', seed: 4242, count: 8 })
  })

  it('falls back to a default for missing/invalid input', () => {
    expect(decodeDescriptor(new URLSearchParams())).toEqual({ kind: 'recursive', seed: 1, count: 6 })
    expect(decodeDescriptor(new URLSearchParams('g=bogus&s=x'))).toEqual({ kind: 'recursive', seed: 1, count: 6 })
  })

  it('clamps an out-of-range count', () => {
    expect(decodeDescriptor(new URLSearchParams('g=modular&s=2&n=99')).count).toBe(12)
    expect(decodeDescriptor(new URLSearchParams('g=modular&s=2&n=1')).count).toBe(2)
  })
})
