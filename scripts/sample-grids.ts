// Quantify grid-engine quality + style coverage + a grounding sample for the adversarial audit.
//   npx vite-node scripts/sample-grids.ts
import { generateGrid } from '../src/grid/engine'
import { scoreGrid } from '../src/grid/score'
import { checkBounds, checkTiling, checkCrispGuides } from '../src/grid/invariants'
import type { Dials } from '../src/grid/genome'

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0)
const pct = (n: number, total: number) => +((100 * n) / total).toFixed(1)

function analyze(seed: number, dials: Dials) {
  const g = generateGrid(seed, dials)
  const areas = g.modules.map((m) => m.w * m.h)
  // RENDERED aspect: unit aspect times the canvas aspect — what the cell actually looks like.
  const ca = g.aspect || 1
  const aspects = g.modules.map((m) => {
    const k = (m.w / m.h) * ca
    return Math.max(k, 1 / k)
  })
  const sb = scoreGrid(g, dials)
  const valid = checkBounds(g.modules, 1e-9) && checkTiling(g.modules, 1e-9).covered && checkCrispGuides(g)
  const areaHerf = areas.reduce((s, a) => s + a * a, 0)
  const genome = g.meta?.genome as { strategy?: string } | undefined
  return {
    seed,
    modules: g.modules.length,
    guides: g.guides.length,
    score: +sb.total.toFixed(3),
    valid,
    strategy: genome?.strategy ?? 'free',
    aspect: +(g.aspect ?? 1).toFixed(3),
    effCells: +(1 / areaHerf).toFixed(2),
    maxAspect: +Math.max(...aspects).toFixed(2),
    sliverFrac: +(aspects.filter((a) => a > 4).length / g.modules.length).toFixed(3),
    lattice: g.meta?.lattice === true,
    alignment: +sb.alignment.toFixed(2),
    hierarchy: +sb.hierarchy.toFixed(2),
    crisp: +sb.whitespaceRhythm.toFixed(2),
    ratioCoh: +sb.ratioCoherence.toFixed(2),
    distinctRatios: (g.meta?.distinctRatios as number) ?? 0,
  }
}

const N = 500
const DEF: Dials = { complexity: 0.5, tension: 0.5, rhythm: 0.5 }
const all = Array.from({ length: N }, (_, i) => analyze(i + 1, DEF))
const scores = all.map((a) => a.score).sort((a, b) => a - b)

// --- mode-collapse detection: how many DISTINCT grids, and how concentrated on the top attractor ---
const fingerprint = (a: (typeof all)[number]) => `${a.modules}|${a.guides}|${a.lattice ? 'L' : 'O'}`
const fpCounts = new Map<string, number>()
for (const a of all) fpCounts.set(fingerprint(a), (fpCounts.get(fingerprint(a)) ?? 0) + 1)
const fpRanked = [...fpCounts.entries()].sort((x, y) => y[1] - x[1])
const moduleCounts = new Set(all.map((a) => a.modules))

const stats = {
  seeds: N,
  validTilingRate: pct(all.filter((a) => a.valid).length, N), // MUST be 100
  // diversity (anti mode-collapse): want MANY distinct grids, low top-attractor share
  distinctFingerprints: fpCounts.size,
  topAttractorPct: pct(fpRanked[0][1], N),
  top3AttractorPct: pct(fpRanked.slice(0, 3).reduce((s, [, c]) => s + c, 0), N),
  distinctModuleCounts: moduleCounts.size,
  scoreMean: +mean(all.map((a) => a.score)).toFixed(3),
  scoreMin: scores[0],
  scoreP10: scores[Math.floor(N * 0.1)],
  scoreP90: scores[Math.floor(N * 0.9)],
  meanModules: +mean(all.map((a) => a.modules)).toFixed(1),
  moduleRange: [Math.min(...all.map((a) => a.modules)), Math.max(...all.map((a) => a.modules))],
  meanMaxAspect: +mean(all.map((a) => a.maxAspect)).toFixed(2),
  pctWithSliver: pct(all.filter((a) => a.maxAspect > 4).length, N), // grids containing any >4:1 cell
  pctHeavySliver: pct(all.filter((a) => a.sliverFrac > 0.15).length, N),
  // --- style coverage: styles should EMERGE, none named ---
  pctNonSquare: pct(all.filter((a) => Math.abs(a.aspect - 1) > 0.01).length, N),
  pctLattice: pct(all.filter((a) => a.lattice).length, N),
  // --- coordinated-strategy emergence (the genres frontier growth can't reach) ---
  pctSpiral: pct(all.filter((a) => a.strategy === 'spiral').length, N),
  pctEcho: pct(all.filter((a) => a.strategy === 'echo').length, N),
  pctMirror: pct(all.filter((a) => a.strategy === 'mirror').length, N),
  pctClearlyLattice: pct(all.filter((a) => a.alignment > 0.8 && a.crisp > 0.7).length, N),
  pctClearHierarchy: pct(all.filter((a) => a.hierarchy > 0.45).length, N),
  pctHighRatioCoh: pct(all.filter((a) => a.ratioCoh > 0.7).length, N),
  meanDistinctRatios: +mean(all.map((a) => a.distinctRatios)).toFixed(2),
}

// dial responsiveness: mean module count / alignment / centroid-driven balance vs each dial
const sweep = (key: keyof Dials, val: number) => {
  const d = { ...DEF, [key]: val }
  const s = Array.from({ length: 120 }, (_, i) => analyze(i * 3 + 1, d))
  return {
    modules: +mean(s.map((a) => a.modules)).toFixed(1),
    alignment: +mean(s.map((a) => a.alignment)).toFixed(2),
    lattice: pct(s.filter((a) => a.lattice).length, s.length),
    score: +mean(s.map((a) => a.score)).toFixed(3),
  }
}
const dials = {
  complexity: { lo: sweep('complexity', 0.1), hi: sweep('complexity', 0.9) },
  rhythm: { lo: sweep('rhythm', 0.1), hi: sweep('rhythm', 0.9) },
  tension: { lo: sweep('tension', 0.1), hi: sweep('tension', 0.9) },
}

// lowest-scoring grids (the "always beautiful floor" — these should be quiet, not ugly)
const worst = [...all].sort((a, b) => a.score - b.score).slice(0, 8)
// a representative spread for the audit
const sample = all.filter((_, i) => i % Math.floor(N / 24) === 0).slice(0, 24)

console.log('===STATS===')
console.log(JSON.stringify(stats, null, 2))
console.log('===DIALS===')
console.log(JSON.stringify(dials, null, 2))
console.log('===WORST===')
console.log(JSON.stringify(worst))
console.log('===SAMPLE===')
console.log(JSON.stringify(sample))
