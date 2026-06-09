import { mulberry32, randInt, type Rng } from './prng'
import type { Grid, Guide, Module } from './types'

/** A composition element's box, in the same px space passed as `fieldW`/`fieldH`. */
export interface CompBox {
  x: number
  y: number
  w: number
  h: number
}

/** Merge near-duplicate values within `tol` from a sorted pass (keeps the first of each cluster). */
function dedupe(vals: number[], tol: number): number[] {
  const s = [...vals].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of s) {
    if (out.length && v - out[out.length - 1] < tol) continue
    out.push(v)
  }
  return out
}

/** Thin an over-long list to at most `max` entries by even stride (keeps spread; deterministic). */
function capEvenly(xs: number[], max: number): number[] {
  if (xs.length <= max) return xs
  const out: number[] = []
  const stride = xs.length / max
  for (let i = 0; i < max; i++) out.push(xs[Math.min(xs.length - 1, Math.floor(i * stride))])
  return dedupe(out, 1e-6)
}

/** k interior cuts of [0,1] by repeated golden-ish subdivision of the current largest gap. */
function goldenSplits(rng: Rng, k: number): number[] {
  const ratios = [0.382, 0.5, 0.618]
  const cuts: number[] = []
  const bounds = [0, 1]
  for (let n = 0; n < k; n++) {
    let bi = 0
    let best = -1
    for (let i = 0; i < bounds.length - 1; i++) {
      const g = bounds[i + 1] - bounds[i]
      if (g > best) {
        best = g
        bi = i
      }
    }
    const lo = bounds[bi]
    const hi = bounds[bi + 1]
    const cut = lo + (hi - lo) * ratios[Math.floor(rng() * ratios.length)]
    cuts.push(cut)
    bounds.splice(bi + 1, 0, cut)
  }
  return cuts.sort((a, b) => a - b)
}

/**
 * Build a valid modular grid ANCHORED to the current composition. Vertical guides snap to the
 * composition's column edges — so the negative-space grid visibly belongs to where the words are
 * NOW, and re-derives whenever they move — while horizontal guides come from a seeded golden
 * subdivision so it keeps randomizing. The result is ALWAYS a zero-gap, in-bounds tiling of the
 * unit square: it works no matter how the composition was rearranged. (That guarantee is the whole
 * point — the user can keep dragging things into new arrangements and the grid keeps "working".)
 *
 * `comp` boxes and `fieldW`/`fieldH` share a px space. Columns are taken from box x-edges
 * normalized by `fieldW`; the grid lives in the upper field, so the x-structure is what carries.
 */
export function composeGrid(seed: number, comp: CompBox[], fieldW: number, fieldH: number): Grid {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0)

  // vertical guides from composition edges, kept off the borders, deduped + capped for cleanliness
  const edges = comp
    .flatMap((b) => [b.x / fieldW, (b.x + b.w) / fieldW])
    .filter((v) => v > 0.06 && v < 0.94)
  const cols = capEvenly(dedupe(edges, 0.03), 6)

  // horizontal guides: 2-4 seeded golden cuts (the part that "keeps randomizing")
  const rows = goldenSplits(rng, randInt(rng, 2, 4))

  const guides: Guide[] = [
    ...cols.map((pos) => ({ axis: 'v' as const, pos })),
    ...rows.map((pos) => ({ axis: 'h' as const, pos })),
  ]

  // modules: the full tiling of the cells between consecutive guides — a zero-gap partition.
  const xb = [0, ...cols, 1]
  const yb = [0, ...rows, 1]
  const modules: Module[] = []
  for (let i = 0; i < xb.length - 1; i++) {
    for (let j = 0; j < yb.length - 1; j++) {
      modules.push({ x: xb[i], y: yb[j], w: xb[i + 1] - xb[i], h: yb[j + 1] - yb[j] })
    }
  }

  return {
    id: `composed-${seed}`,
    seed,
    generator: 'modular',
    params: { kind: 'modular', columns: xb.length - 1, rows: yb.length - 1, margin: 0, gutter: 0 },
    aspect: fieldW / fieldH,
    guides,
    modules,
    ratios: [],
    meta: { composed: true, cols: cols.length, rows: rows.length },
  }
}
