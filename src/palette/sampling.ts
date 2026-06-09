/**
 * Seeded statistical primitives for the procedural palette generator. No color here — just the
 * distributions the engine samples from. Everything takes an `Rng` (mulberry32) so a seed fully
 * determines the draw; nothing reads global state.
 *
 * The star is `vonMises`: the circular ("wrap-around") analogue of a Gaussian. Hue lives on a
 * circle, so you can't sample it with a normal distribution — a normal has tails that run off to
 * ±∞, but 359° and 1° are 2° apart, not 358°. The von Mises distribution is defined on the circle
 * with a mean direction μ and a concentration κ: κ→0 is uniform (every hue equally likely), large κ
 * is a tight cluster around μ. A *mixture* of a few von Mises modes is what lets one mechanism span
 * monochrome (1 tight mode) → analogous (1 loose) → complementary (2 opposite) → triad (3 spread)
 * → chaotic (low κ), continuously and with no named schemes.
 */

import { type Rng } from '../grid/prng'

const TAU = Math.PI * 2
const DEG = 180 / Math.PI
const RAD = Math.PI / 180

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const wrap360 = (d: number): number => ((d % 360) + 360) % 360

/** Standard normal sample (Box–Muller). */
export function gaussian(rng: Rng): number {
  const u1 = Math.max(1e-12, rng())
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2)
}

/** Normal sample with mean/sd. */
export function normal(rng: Rng, mean: number, sd: number): number {
  return mean + sd * gaussian(rng)
}

/**
 * Sample a hue (degrees) from a von Mises distribution with mean `muDeg` and concentration `kappa`.
 * kappa≈0 → uniform on the circle; large kappa → tight around mu. Best & Fitch (1979) rejection
 * sampler — exact, no lookup tables. Falls back to mu if rejection somehow stalls (it won't).
 */
export function vonMises(rng: Rng, muDeg: number, kappa: number): number {
  if (kappa < 1e-6) return rng() * 360
  const mu = muDeg * RAD
  const a = 1 + Math.sqrt(1 + 4 * kappa * kappa)
  const b = (a - Math.sqrt(2 * a)) / (2 * kappa)
  const r = (1 + b * b) / (2 * b)
  for (let i = 0; i < 100; i++) {
    const u1 = rng()
    const z = Math.cos(Math.PI * u1)
    const f = (1 + r * z) / (r + z)
    const c = kappa * (r - f)
    const u2 = rng()
    if (c * (2 - c) - u2 > 0 || Math.log(c / u2) + 1 - c >= 0) {
      const sign = rng() < 0.5 ? -1 : 1
      return wrap360((mu + sign * Math.acos(clamp(f, -1, 1))) * DEG)
    }
  }
  return wrap360(muDeg)
}

/**
 * Place `n` ordered points in [0,1] (low→high) and warp them with a skew so the cluster sits low,
 * high, or even. `skew` 0 = even ladder; skew>0 packs points toward 1 (high-key); skew<0 toward 0
 * (low-key). A deterministic quantile warp (not random draws) so coverage is smooth — no clumping,
 * no gaps — which is what you want for a lightness ramp. `t^(2^-skew)` is the warp: skew flips it
 * around the identity line. Returns ascending values; the engine maps these into a contrast band.
 */
export function warpedLadder(n: number, skew: number): number[] {
  const g = Math.pow(2, -skew) // skew>0 => exponent<1 => push toward 1
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    out.push(Math.pow(t, g))
  }
  return out
}

/** Mean resultant length R of a set of hues (degrees): 0 = hues spread evenly around the wheel,
 * 1 = all identical. A cheap, honest measure of hue "tightness" for the harmony score. */
export function circularResultant(huesDeg: number[]): number {
  if (huesDeg.length === 0) return 0
  let sx = 0
  let sy = 0
  for (const h of huesDeg) {
    sx += Math.cos(h * RAD)
    sy += Math.sin(h * RAD)
  }
  return Math.hypot(sx, sy) / huesDeg.length
}

/** Smallest absolute angular gap (degrees, 0..180) between two hues. */
export function hueGap(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}
