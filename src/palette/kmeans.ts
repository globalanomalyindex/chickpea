import { mulberry32 } from '../grid/prng'
import { gamutMapToRgb, oklchToOklab, rgbToOklch } from './oklch'

export interface ColorWeight {
  rgb: [number, number, number]
  weight: number
}

const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

/** sRGB triple → OKLab point. Clustering distance is judged where the EYE judges it. */
function toLab(rgb: [number, number, number]): [number, number, number] {
  return oklchToOklab(rgbToOklch(rgb))
}

/** OKLab centroid → sRGB triple (gamut mapping is a near-no-op for a mean of real pixels). */
function toRgb(lab: number[]): [number, number, number] {
  let H = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI
  if (H < 0) H += 360
  return gamutMapToRgb({ L: lab[0], C: Math.hypot(lab[1], lab[2]), H })
}

/**
 * K-means over image pixels, done the way "extract ALL the colors" actually requires:
 *
 *   - distance lives in OKLAB, not RGB — RGB distance under-separates vivid hues and
 *     over-separates darks, so visually distinct colors used to merge into one cluster
 *   - seeding is K-MEANS++ (each next seed drawn ∝ distance² from the chosen ones), not k random
 *     pixels — random pixel seeds mostly land inside the dominant background mass, which is how a
 *     small-but-salient color (the red logo on a white page) got absorbed and never extracted
 *
 * Runs `iters` Lloyd passes and returns one ColorWeight per non-empty cluster, sorted by
 * descending weight (member count). Pure: same (pixels, k, seed) always yields a byte-identical
 * result (mulberry32 drives every draw).
 */
export function kmeans(pixels: [number, number, number][], k: number, seed: number, iters = 12): ColorWeight[] {
  if (pixels.length === 0) return []
  const rng = mulberry32(seed)
  const pts = pixels.map(toLab)
  const kk = Math.min(k, pts.length)

  // k-means++ seeding: first seed from the rng, each next ∝ squared distance to the nearest seed
  const centroids: number[][] = [[...pts[Math.floor(rng() * pts.length)]]]
  const nearest = new Array<number>(pts.length).fill(Infinity)
  while (centroids.length < kk) {
    const c = centroids[centroids.length - 1]
    let total = 0
    for (let p = 0; p < pts.length; p++) {
      const dd = d2(pts[p], c)
      if (dd < nearest[p]) nearest[p] = dd
      total += nearest[p]
    }
    if (total <= 1e-12) break // every pixel already sits on a seed (a flat image)
    let r = rng() * total
    let idx = pts.length - 1
    for (let p = 0; p < pts.length; p++) {
      r -= nearest[p]
      if (r <= 0) {
        idx = p
        break
      }
    }
    centroids.push([...pts[idx]])
  }

  const assign = new Array(pts.length).fill(0)
  // sums[c] = [L, a, b, count] for the most recent assignment pass; sums[c][3]
  // is the per-cluster member count we reuse as the final weight below. Seeded
  // from the initial all-zero `assign` so the result matches even when iters===0.
  let sums = centroids.map(() => [0, 0, 0, 0])
  for (const a of assign) sums[a][3]++
  for (let it = 0; it < iters; it++) {
    // assign
    for (let p = 0; p < pts.length; p++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const dd = d2(pts[p], centroids[c])
        if (dd < bestD) {
          bestD = dd
          best = c
        }
      }
      assign[p] = best
    }
    // update
    sums = centroids.map(() => [0, 0, 0, 0])
    for (let p = 0; p < pts.length; p++) {
      const a = assign[p]
      sums[a][0] += pts[p][0]
      sums[a][1] += pts[p][1]
      sums[a][2] += pts[p][2]
      sums[a][3]++
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0)
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]]
    }
  }
  return centroids
    .map((c, i) => ({ rgb: toRgb(c), weight: sums[i][3] }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}
