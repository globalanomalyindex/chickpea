// Quantify palette-engine quality + emit a grounding sample for the adversarial audit.
//   npx vite-node scripts/sample-palettes.ts
import { generatePaletteOklch } from '../src/palette/engine'
import { paletteFromOklch } from '../src/palette/engine'
import { scorePalette } from '../src/palette/score'
import { deltaE } from '../src/palette/oklch'
import { circularResultant } from '../src/palette/sampling'

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
