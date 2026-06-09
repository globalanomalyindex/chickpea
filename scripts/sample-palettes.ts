// Quantify palette-engine quality + emit a grounding sample for the adversarial audit.
//   npx vite-node scripts/sample-palettes.ts
import { generatePaletteOklch } from '../src/palette/engine'
import { paletteFromOklch } from '../src/palette/engine'
import { scorePalette, hueClusters } from '../src/palette/score'
import { deltaE } from '../src/palette/oklch'
import { circularResultant, hueDelta } from '../src/palette/sampling'

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const std = (a: number[]) => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((v) => (v - m) * (v - m))))
}

function analyze(seed: number, count: number) {
  const cs = generatePaletteOklch(seed, count)
  const hexes = paletteFromOklch(cs).map((c) => c.hex)
  const Ls = cs.map((c) => c.L)
  const Cs = cs.map((c) => c.C)
  let minDE = Infinity
  for (let i = 0; i < cs.length; i++) for (let j = 0; j < i; j++) minDE = Math.min(minDE, deltaE(cs[i], cs[j]))
  const sb = scorePalette(cs)
  return {
    seed,
    count,
    hexes,
    colors: cs.map((c) => ({ L: +c.L.toFixed(3), C: +c.C.toFixed(3), H: +c.H.toFixed(1) })),
    score: +sb.total.toFixed(3),
    breakdown: {
      contrast: +sb.contrast.toFixed(2),
      separation: +sb.separation.toFixed(2),
      harmony: +sb.harmony.toFixed(2),
      focal: +sb.focal.toFixed(2),
      antiMud: +sb.antiMud.toFixed(2),
      pigment: +sb.pigment.toFixed(2),
    },
    lSpread: +(Math.max(...Ls) - Math.min(...Ls)).toFixed(3),
    minDeltaE: +minDE.toFixed(3),
    hueResultant: +circularResultant(cs.map((c) => c.H)).toFixed(3),
    meanC: +mean(Cs).toFixed(3),
    chromaCV: +(mean(Cs) > 1e-4 ? std(Cs) / mean(Cs) : 0).toFixed(2),
    nearBlack: cs.filter((c) => c.L < 0.16 && c.C < 0.045).length,
    nearWhite: cs.filter((c) => c.L > 0.92 && c.C < 0.045).length,
    grayish: cs.filter((c) => c.C < 0.03).length,
  }
}

const N = 500
const COUNT = 6
const all = Array.from({ length: N }, (_, i) => analyze(i + 1, COUNT))

const scores = all.map((a) => a.score)
const pct = (n: number) => +((100 * n) / N).toFixed(1)
// chromatic colors = perceptually "has a hue" (C>0.045). darkest = lowest-L slot.
const chromaCount = (a: (typeof all)[number]) => a.colors.filter((c) => c.C > 0.045).length
const darkestL = (a: (typeof all)[number]) => Math.min(...a.colors.map((c) => c.L))
const lightestL = (a: (typeof all)[number]) => Math.max(...a.colors.map((c) => c.L))

// ramp = chromatic hues travel monotonically (≥70% of total movement one way) over ≥minSpan° with
// L, in GRADUAL steps (each ≤55°). Without the step cap this also counts any multi-family palette
// whose clusters sit at their natural lightness (blue dark, yellow light — gamut physics sorts hue
// families by L), which is a triad, not a gradient.
const rampSpan = (a: (typeof all)[number]) => {
  const cs = a.colors.filter((c) => c.C > 0.045).sort((x, y) => x.L - y.L)
  if (cs.length < 4) return 0
  let signed = 0
  let total = 0
  let maxStep = 0
  for (let i = 1; i < cs.length; i++) {
    const d = hueDelta(cs[i - 1].H, cs[i].H)
    signed += d
    total += Math.abs(d)
    maxStep = Math.max(maxStep, Math.abs(d))
  }
  return total > 1e-6 && Math.abs(signed) / total >= 0.7 && maxStep <= 55 ? Math.abs(signed) : 0
}
const isRamp = (a: (typeof all)[number]) => rampSpan(a) >= 40
const isStrongRamp = (a: (typeof all)[number]) => rampSpan(a) >= 85 // a true sunset, not analogous drift
const clusterCount = (a: (typeof all)[number]) => {
  const maxC = Math.max(...a.colors.map((c) => c.C))
  return hueClusters(a.colors.filter((c) => c.C > 0.03 * maxC).map((c) => ({ H: c.H, C: c.C }))).length
}
// dominant family: ≥2 clusters and the largest holds 55..85% of the chroma mass (60-30-10, not mono)
const hasDominantFamily = (a: (typeof all)[number]) => {
  const maxC = Math.max(...a.colors.map((c) => c.C))
  const chroma = a.colors.filter((c) => c.C > 0.03 * maxC)
  const centers = hueClusters(chroma.map((c) => ({ H: c.H, C: c.C })))
  if (centers.length < 2) return false
  const gap = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180)
  const mass = centers.map(() => 0)
  let total = 0
  for (const c of chroma) {
    let best = 0
    for (let i = 1; i < centers.length; i++) if (gap(c.H, centers[i]) < gap(c.H, centers[best])) best = i
    mass[best] += c.C
    total += c.C
  }
  const top = Math.max(...mass) / (total || 1)
  return top >= 0.55 && top <= 0.85
}
const histo = (xs: number[]) => {
  const h: Record<string, number> = {}
  for (const x of xs) h[x] = (h[x] ?? 0) + 1
  return h
}
// inter-seed diversity: mean pairwise distance of normalized palette signatures. If the engine
// collapses onto one genre this number craters — the alarm the grid engine taught us to keep.
const interSeedDiversity = () => {
  const sig = all.map((a) => [
    a.meanC / 0.2,
    a.hueResultant,
    darkestL(a),
    lightestL(a),
    a.lSpread,
    chromaCount(a) / COUNT,
  ])
  let sum = 0
  let cnt = 0
  for (let i = 0; i < sig.length; i++)
    for (let j = 0; j < i; j++) {
      let d = 0
      for (let k = 0; k < sig[i].length; k++) d += (sig[i][k] - sig[j][k]) ** 2
      sum += Math.sqrt(d)
      cnt++
    }
  return sum / cnt
}
const stats = {
  seeds: N,
  count: COUNT,
  scoreMean: +mean(scores).toFixed(3),
  scoreMin: +Math.min(...scores).toFixed(3),
  scoreP10: +[...scores].sort((a, b) => a - b)[Math.floor(N * 0.1)].toFixed(3),
  pctWithNearBlack: pct(all.filter((a) => a.nearBlack >= 1).length),
  pctWithNearWhite: pct(all.filter((a) => a.nearWhite >= 1).length),
  pctMostlyGray: pct(all.filter((a) => a.grayish >= Math.ceil(COUNT * 0.6)).length),
  meanChroma: +mean(all.map((a) => a.meanC)).toFixed(3),
  meanHueResultant: +mean(all.map((a) => a.hueResultant)).toFixed(3),
  // --- genre reachability + dud detection (from the audit) ---
  pctLoneChip: pct(all.filter((a) => chromaCount(a) <= 1).length), // "1 pop + grays" dud
  pctTwoOrFewerChroma: pct(all.filter((a) => chromaCount(a) <= 2).length),
  pctPastelHighKey: pct(all.filter((a) => darkestL(a) > 0.55).length), // all-light reachable?
  pctNeonJewel: pct(all.filter((a) => a.colors.filter((c) => c.C > 0.16).length >= 3).length), // all-vivid?
  pctTightHue: pct(all.filter((a) => a.hueResultant > 0.85).length),
  pctSpreadHue: pct(all.filter((a) => a.hueResultant < 0.45).length),
  meanChromaCount: +mean(all.map(chromaCount)).toFixed(2),
  // --- genre coverage for the upgraded engine ---
  pctRamp: pct(all.filter(isRamp).length), // monotone hue travel with lightness (sunset/ocean)
  pctStrongRamp: pct(all.filter(isStrongRamp).length),
  pctLowKeyMoody: pct(all.filter((a) => lightestL(a) < 0.55).length),
  pctDominantFamily: pct(all.filter(hasDominantFamily).length), // 60-30-10 hue structure
  clusterHistogram: histo(all.map(clusterCount)),
  interSeedDiversity: +interSeedDiversity().toFixed(3), // mean pairwise feature distance — collapse alarm
}
const dudSeeds = [193, 209, 417, 321, 65, 289, 353]
const duds = dudSeeds.map((s) => {
  const a = analyze(s, COUNT)
  return { seed: s, score: a.score, chromaCount: chromaCount(a), meanC: a.meanC, maxC: Math.max(...a.colors.map((c) => c.C)), hr: a.hueResultant, dL: +darkestL(a).toFixed(2), lL: +lightestL(a).toFixed(2) }
})

// a representative spread of 30 palettes for the critics (every Nth)
const sample = all.filter((_, i) => i % Math.floor(N / 30) === 0).slice(0, 30)

console.log('===STATS===')
console.log(JSON.stringify(stats, null, 2))
console.log('===DUDS=== (audit-flagged seeds — score should now be lower / fixed)')
console.log(JSON.stringify(duds))
console.log('===SAMPLE===')
console.log(JSON.stringify(sample))
