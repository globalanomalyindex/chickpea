import { describe, it, expect } from 'vitest'
import { encodeDescriptor, decodeDescriptor } from './serialize'

describe('descriptor serialization', () => {
  it('round-trips kind + seed', () => {
    const params = new URLSearchParams()
    encodeDescriptor({ kind: 'nature', seed: 4242 }, params)
    expect(params.get('g')).toBe('nature')
    expect(params.get('s')).toBe('4242')
    expect(decodeDescriptor(params)).toEqual({ kind: 'nature', seed: 4242 })
  })

  it('falls back to a default for missing/invalid input', () => {
    expect(decodeDescriptor(new URLSearchParams())).toEqual({ kind: 'recursive', seed: 1 })
    expect(decodeDescriptor(new URLSearchParams('g=bogus&s=x'))).toEqual({ kind: 'recursive', seed: 1 })
  })
})
