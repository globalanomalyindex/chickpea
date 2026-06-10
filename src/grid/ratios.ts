/**
 * The ratio canon — the single vocabulary of proportions shared by the generator (genome voices),
 * the scorer (residual checks) and the human anchor system (snap targets + truthful labels).
 * One module so the three can never drift apart: a position the sampler can cut at is, by
 * construction, a position the snapper can name.
 */

/** The third metallic mean (bronze), σ₃ = (3+√13)/2 ≈ 3.303; its reciprocal section ≈ 0.303.
 * Gold (φ), silver (1+√2) and bronze are the first three of the metallic means, the family of
 * self-similar proportions x = n + 1/x that nature keeps reusing at different "weights". */
const BRONZE = (Math.sqrt(13) - 3) / 2 // 1/σ₃ ≈ 0.30278

/**
 * Ratio-correct cut positions — the vocabulary of proportions an anchor guide may land on, so every
 * committed cut is provably one of the design ratios:
 *   - the small-denominator rationals: halves, thirds, quarters, fifths, sixths, SEVENTHS, eighths,
 *     NINTHS (the modular subdivisions a designer reaches for)
 *   - the golden sections (1−1/φ ≈ 0.382 / 1/φ ≈ 0.618), the seed-spiral ratio of a sunflower
 *   - the √5 sections (√5−2 ≈ 0.236 / 3−√5 ≈ 0.764)
 *   - the √2-rectangle sections (1−1/√2 ≈ 0.293 / 1/√2 ≈ 0.707), the ISO paper proportion
 *   - the SILVER sections (√2−1 ≈ 0.414 / 2−√2 ≈ 0.586) — the white-silver ratio (hakugin-hi)
 *   - the BRONZE sections (≈ 0.303 / 0.697), completing the gold→silver→bronze metallic-means trio
 */
export const RATIO_POSITIONS = [
  0.5, 1 / 3, 2 / 3, 0.382, 0.618, 0.25, 0.75, 0.236, 0.764, 0.2, 0.8,
  1 / 6, 5 / 6, 0.125, 0.375, 0.625, 0.875, 1 - 1 / Math.SQRT2, 1 / Math.SQRT2,
  Math.SQRT2 - 1, 2 - Math.SQRT2,
  // sevenths and ninths complete the small-denominator rational grid
  1 / 7, 2 / 7, 3 / 7, 4 / 7, 5 / 7, 6 / 7,
  1 / 9, 2 / 9, 4 / 9, 5 / 9, 7 / 9, 8 / 9,
  // bronze section + complement
  BRONZE, 1 - BRONZE,
]

/** Nearest ratio-correct position to a rough human cut. */
export function snapToRatio(pos: number): number {
  let best = RATIO_POSITIONS[0]
  let bestD = Infinity
  for (const r of RATIO_POSITIONS) {
    const d = Math.abs(pos - r)
    if (d < bestD) {
      bestD = d
      best = r
    }
  }
  return best
}

const EPS = 1e-6
const near = (a: number, b: number): boolean => Math.abs(a - b) < EPS

/**
 * A readable label for a snapped cut *position* (for reveal annotations).
 *
 * The annotation prints `name value.toFixed(3)`, where `value` is the position itself
 * (e.g. 0.618), so the name must denote that same position — not the irrational ratio the
 * section is *derived* from. We therefore label each snap point by the fraction or section
 * it lands on: "1/φ 0.618" (the major golden section, 1/φ ≈ 0.618) is truthful, whereas
 * "φ 0.618" would not be (φ ≈ 1.618). Symmetric points get the complementary fraction so
 * the label and number always agree.
 */
export function ratioName(pos: number): string {
  if (near(pos, 0.5)) return '½'
  if (near(pos, 1 / 3)) return '⅓'
  if (near(pos, 2 / 3)) return '⅔'
  if (near(pos, 0.382)) return '1−1/φ' // minor golden section ≈ 0.382
  if (near(pos, 0.618)) return '1/φ' // major golden section ≈ 0.618
  if (near(pos, 0.25)) return '¼'
  if (near(pos, 0.75)) return '¾'
  if (near(pos, 0.236)) return '√5−2' // ≈ 0.236
  if (near(pos, 0.764)) return '3−√5' // complement of √5−2, ≈ 0.764
  if (near(pos, 0.2)) return '⅕'
  if (near(pos, 0.8)) return '⅘'
  if (near(pos, 1 / 6)) return '⅙'
  if (near(pos, 5 / 6)) return '⅚'
  if (near(pos, 0.125)) return '⅛'
  if (near(pos, 0.375)) return '⅜'
  if (near(pos, 0.625)) return '⅝'
  if (near(pos, 0.875)) return '⅞'
  if (near(pos, 1 - 1 / Math.SQRT2)) return '1−1/√2' // ≈ 0.293, the √2-rectangle section
  if (near(pos, 1 / Math.SQRT2)) return '1/√2' // ≈ 0.707
  if (near(pos, Math.SQRT2 - 1)) return '√2−1' // ≈ 0.414, the silver section
  if (near(pos, 2 - Math.SQRT2)) return '2−√2' // ≈ 0.586, its complement
  if (near(pos, 1 / 7)) return '1/7'
  if (near(pos, 2 / 7)) return '2/7'
  if (near(pos, 3 / 7)) return '3/7'
  if (near(pos, 4 / 7)) return '4/7'
  if (near(pos, 5 / 7)) return '5/7'
  if (near(pos, 6 / 7)) return '6/7'
  if (near(pos, 1 / 9)) return '1/9'
  if (near(pos, 2 / 9)) return '2/9'
  if (near(pos, 4 / 9)) return '4/9'
  if (near(pos, 5 / 9)) return '5/9'
  if (near(pos, 7 / 9)) return '7/9'
  if (near(pos, 8 / 9)) return '8/9'
  if (near(pos, BRONZE)) return '1/σ₃' // bronze section ≈ 0.303 (third metallic mean)
  if (near(pos, 1 - BRONZE)) return '1−1/σ₃' // ≈ 0.697
  return pos.toFixed(3)
}
