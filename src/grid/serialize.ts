import { GENERATOR_KINDS } from './generators'
import type { GeneratorKind } from './types'

export interface Descriptor {
  kind: GeneratorKind
  seed: number
}

const DEFAULT: Descriptor = { kind: 'recursive', seed: 1 }

export function encodeDescriptor(d: Descriptor, params: URLSearchParams): void {
  params.set('g', d.kind)
  params.set('s', String(d.seed))
}

export function decodeDescriptor(params: URLSearchParams): Descriptor {
  const kind = params.get('g')
  const seed = Number(params.get('s'))
  if (!kind || !GENERATOR_KINDS.includes(kind as GeneratorKind) || !Number.isFinite(seed)) {
    return { ...DEFAULT }
  }
  return { kind: kind as GeneratorKind, seed: Math.trunc(seed) }
}
