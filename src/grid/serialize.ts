import { GENERATOR_KINDS } from './generators'
import type { GeneratorKind } from './types'

export interface Descriptor {
  kind: GeneratorKind
  seed: number
  count: number
}

const DEFAULT: Descriptor = { kind: 'recursive', seed: 1, count: 6 }

export function encodeDescriptor(d: Descriptor, params: URLSearchParams): void {
  params.set('g', d.kind)
  params.set('s', String(d.seed))
  params.set('n', String(d.count))
}

export function decodeDescriptor(params: URLSearchParams): Descriptor {
  const kind = params.get('g')
  const seed = Number(params.get('s'))
  if (!kind || !GENERATOR_KINDS.includes(kind as GeneratorKind) || !Number.isFinite(seed)) {
    return { ...DEFAULT }
  }
  const count = Number(params.get('n'))
  return {
    kind: kind as GeneratorKind,
    seed: Math.trunc(seed),
    count: Number.isFinite(count) ? Math.min(12, Math.max(2, Math.trunc(count))) : DEFAULT.count,
  }
}
