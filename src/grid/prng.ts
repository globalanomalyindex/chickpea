export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * Turn any seed string into a uint32 the engines can use — Minecraft-style: a plain integer is used
 * as itself (so old numeric seeds still reproduce exactly), and anything else (letters, symbols,
 * whole sentences, huge numbers past 2³²) is hashed with FNV-1a. Same string always yields the same
 * number, so a typed seed is a shareable, reproducible composition.
 */
export function hashSeed(s: string): number {
  const t = s.trim()
  if (/^-?\d{1,9}$/.test(t)) return Math.abs(Number(t)) >>> 0 // small integer: use it directly
  let h = 0x811c9dc5 // FNV-1a 32-bit offset basis
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
