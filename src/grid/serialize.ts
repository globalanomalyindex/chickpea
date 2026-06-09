import { DEFAULT_DIALS, type Dials } from './genome'

/** The shareable studio state: the 3 expressive dials + seed + palette colour count. No "kind" — the
 * engine has no named generators; style emerges from (seed, dials). */
export interface Descriptor {
  complexity: number
  tension: number
  rhythm: number
  seed: number
  count: number
}

const DEFAULT: Descriptor = { ...DEFAULT_DIALS, seed: 1, count: 6 }

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Read a 0..1 dial from a param, falling back to `def` when missing/NaN. NB: `Number(null) === 0`,
 * so an absent key must be guarded explicitly or it would read as 0 rather than the default. */
function dial(params: URLSearchParams, key: string, def: number): number {
  const raw = params.get(key)
  if (raw === null || raw === '') return def
  const v = Number(raw)
  return Number.isFinite(v) ? clamp01(v) : def
}
/** Read an integer param, falling back to `def` when missing/NaN (same null-coercion guard). */
function int(params: URLSearchParams, key: string, def: number): number | null {
  const raw = params.get(key)
  if (raw === null || raw === '') return def
  const v = Number(raw)
  return Number.isFinite(v) ? Math.trunc(v) : def
}

export function encodeDescriptor(d: Descriptor, params: URLSearchParams): void {
  params.set('cx', d.complexity.toFixed(2))
  params.set('tn', d.tension.toFixed(2))
  params.set('rh', d.rhythm.toFixed(2))
  params.set('s', String(d.seed))
  params.set('n', String(d.count))
}

export function decodeDescriptor(params: URLSearchParams): Descriptor {
  const seed = int(params, 's', DEFAULT.seed) as number
  const countRaw = int(params, 'n', DEFAULT.count) as number
  const count = Math.min(12, Math.max(2, countRaw))
  return {
    complexity: dial(params, 'cx', DEFAULT.complexity),
    tension: dial(params, 'tn', DEFAULT.tension),
    rhythm: dial(params, 'rh', DEFAULT.rhythm),
    seed,
    count,
  }
}

/** The dials slice of a descriptor (for handing straight to generateGrid). */
export function descriptorDials(d: Descriptor): Dials {
  return { complexity: d.complexity, tension: d.tension, rhythm: d.rhythm }
}
