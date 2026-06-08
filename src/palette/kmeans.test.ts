import { describe, it, expect } from 'vitest'
import { kmeans } from './kmeans'

// three tight clusters around red, green, blue
function cluster(base: [number, number, number], n: number, jitter = 5): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++) out.push([base[0] + (i % jitter), base[1], base[2]] as [number, number, number])
  return out
}

describe('kmeans', () => {
  const pixels = [...cluster([240, 10, 10], 30), ...cluster([10, 230, 10], 20), ...cluster([10, 10, 220], 10)]

  it('returns k clusters sorted by descending weight, deterministic', () => {
    const a = kmeans(pixels, 3, 1)
    const b = kmeans(pixels, 3, 1)
    expect(a.length).toBe(3)
    expect(a).toEqual(b)
    for (let i = 1; i < a.length; i++) expect(a[i].weight).toBeLessThanOrEqual(a[i - 1].weight)
  })

  it('finds centroids near the true cluster centers', () => {
    const c = kmeans(pixels, 3, 1)
    const reds = c.find((x) => x.rgb[0] > 150)!
    expect(reds.rgb[0]).toBeGreaterThan(150)
    expect(reds.weight).toBe(30) // the red cluster is largest
  })

  it('returns an empty palette for no pixels', () => {
    expect(kmeans([], 4, 1)).toEqual([])
  })
})
