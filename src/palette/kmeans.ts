import { mulberry32 } from '../grid/prng'

export interface ColorWeight {
  rgb: [number, number, number]
  weight: number
}

const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

/**
 * Lloyd's k-means over RGB pixels. Seeds centroids from k distinct random pixels
 * (mulberry32 → deterministic for a given seed), runs `iters` assign/update passes,
 * and returns one ColorWeight per non-empty cluster, sorted by descending weight
 * (member count). Pure: same (pixels, k, seed) always yields a byte-identical result.
 */
export function kmeans(pixels: [number, number, number][], k: number, seed: number, iters = 12): ColorWeight[] {
  if (pixels.length === 0) return []
  const rng = mulberry32(seed)
  // seed centroids from k distinct random pixels
  const centroids: number[][] = []
  const used = new Set<number>()
  while (centroids.length < k && used.size < pixels.length) {
    const idx = Math.floor(rng() * pixels.length)
    if (used.has(idx)) continue
    used.add(idx)
    centroids.push([...pixels[idx]])
  }
  const assign = new Array(pixels.length).fill(0)
  for (let it = 0; it < iters; it++) {
    // assign
    for (let p = 0; p < pixels.length; p++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const dd = d2(pixels[p], centroids[c])
        if (dd < bestD) {
          bestD = dd
          best = c
        }
      }
      assign[p] = best
    }
    // update
    const sums = centroids.map(() => [0, 0, 0, 0])
    for (let p = 0; p < pixels.length; p++) {
      const a = assign[p]
      sums[a][0] += pixels[p][0]
      sums[a][1] += pixels[p][1]
      sums[a][2] += pixels[p][2]
      sums[a][3]++
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0)
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]]
    }
  }
  const counts = centroids.map(() => 0)
  for (const a of assign) counts[a]++
  return centroids
    .map((c, i) => ({
      rgb: [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as [number, number, number],
      weight: counts[i],
    }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)
}
