/*
 * Letter-by-letter color treatments, ported from the diffusion-render-text portfolio piece so the
 * two projects share a signature: the author's name rides a perceptual rainbow, and a natural noun
 * wears the colors of the thing it names. Solid color per letter (not a clipped gradient) so it stays
 * crisp at any size. Both carry an aria-label so assistive tech reads the word, not the letter spans.
 *
 * The OKLCH ramps were tuned for a cream page; here they sit on the slate field, so each accepts a
 * `lighten` lift that raises L (preserving hue identity) to keep contrast on the darker background.
 */

const clampL = (l: number): number => (l < 0 ? 0 : l > 0.97 ? 0.97 : l)

/** The per-letter rainbow color: hue = (i / (total-1)) * sweep, at a fixed L/C. Exported so the hero
 * can color a name that spans several independently-movable word spans with one continuous sweep. */
export function rainbowColor(i: number, total: number, l = 0.72, c = 0.16, sweep = 320): string {
  const last = Math.max(1, total - 1)
  return `oklch(${clampL(l)} ${c} ${Math.round((i / last) * sweep)})`
}

/**
 * The name rainbow: hue sweeps 0 -> `sweep` across the letters at a fixed L/C, exactly the effect
 * from the sister project. Spaces are preserved but uncolored; the hue index counts every character
 * so the sweep is even across the whole phrase.
 */
export function RainbowText({
  text,
  l = 0.7,
  c = 0.16,
  sweep = 320,
  style,
}: {
  text: string
  l?: number
  c?: number
  sweep?: number
  style?: React.CSSProperties
}) {
  const chars = text.split('')
  const last = Math.max(1, chars.length - 1)
  return (
    <span aria-label={text} style={style}>
      {chars.map((ch, i) =>
        ch === ' ' ? (
          ' '
        ) : (
          <span key={i} aria-hidden style={{ color: `oklch(${clampL(l)} ${c} ${Math.round((i / last) * sweep)})` }}>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

type Stop = [number, number, number] // OKLCH L, C, H
export type NatureKind = 'nature' | 'leaves' | 'sunflower' | 'nautilus'

/** Per-thing OKLCH ramps. `nature` is the whole spread: leaf-green -> gold -> sky -> earth. */
const PALETTES: Record<NatureKind, Stop[]> = {
  nature: [
    [0.52, 0.13, 142],
    [0.64, 0.14, 88],
    [0.55, 0.07, 232],
    [0.47, 0.08, 54],
  ],
  leaves: [
    [0.5, 0.13, 136],
    [0.57, 0.15, 142],
    [0.62, 0.13, 150],
    [0.52, 0.12, 126],
  ],
  sunflower: [
    [0.45, 0.1, 64],
    [0.58, 0.13, 74],
    [0.67, 0.15, 85],
    [0.7, 0.15, 95],
  ],
  nautilus: [
    [0.46, 0.08, 40],
    [0.55, 0.1, 48],
    [0.63, 0.09, 58],
    [0.5, 0.08, 36],
  ],
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Shortest-path hue interpolation so a ramp never spins the long way around the wheel. */
const lerpHue = (a: number, b: number, t: number): number => {
  const d = (((b - a + 540) % 360) - 180) * t
  return (a + d + 360) % 360
}

/** `n` solid OKLCH colors stepped across the kind's ramp, one per letter; `lighten` lifts L for slate. */
export function naturePalette(kind: NatureKind, n: number, lighten = 0): string[] {
  const stops = PALETTES[kind] ?? PALETTES.nature
  if (n <= 1) return [`oklch(${clampL(stops[0][0] + lighten)} ${stops[0][1]} ${stops[0][2]})`]
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const pos = (i / (n - 1)) * (stops.length - 1)
    const idx = Math.min(stops.length - 2, Math.floor(pos))
    const f = pos - idx
    const a = stops[idx]
    const b = stops[idx + 1]
    out.push(`oklch(${clampL(lerp(a[0], b[0], f) + lighten).toFixed(3)} ${lerp(a[1], b[1], f).toFixed(3)} ${lerpHue(a[2], b[2], f).toFixed(1)})`)
  }
  return out
}

/** A natural noun painted letter by letter in the colors of the thing it names. */
export function NatureWord({
  kind = 'nature',
  children,
  lighten = 0.14,
  style,
}: {
  kind?: NatureKind
  children: string
  lighten?: number
  style?: React.CSSProperties
}) {
  const letters = Array.from(children)
  const colors = naturePalette(kind, letters.filter((c) => c !== ' ').length, lighten)
  let ci = 0
  return (
    <span aria-label={children} data-nature={kind} style={style}>
      {letters.map((ch, i) =>
        ch === ' ' ? ' ' : (
          <span key={i} aria-hidden style={{ color: colors[ci++] }}>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

/**
 * Word ramps for the case study's letter-painted natural nouns — each the OKLCH colors of the thing
 * the word names, tuned to read on the SLATE field (#5d646b, L≈0.52): lightnesses sit clearly above
 * or below the field, chroma carries the rest, and no stop hides in the background's own blue-gray.
 * Used only on occurrences VETTED for natural meaning (marked `{{word}}` in content.ts), so "leaf"
 * the plant is painted but "leaf through" would not be.
 */
const WORD_RAMPS: Record<string, Stop[]> = {
  // every ramp is tuned to clear the slate field (L≈0.52): "lit" words floor around L 0.66 so a
  // green or a brown never sinks into the background; the few words that ARE dark (charcoal) keep
  // real lightness distance below the field plus a touch of warmth, and a faint dark halo on every
  // letter (see TintWord) guarantees the rest.
  petals: [[0.76, 0.14, 8], [0.82, 0.11, 350], [0.78, 0.15, 28], [0.73, 0.16, 342]],
  plumage: [[0.72, 0.13, 188], [0.68, 0.15, 252], [0.74, 0.14, 158], [0.68, 0.15, 300]],
  'leaf venation': [[0.66, 0.15, 146], [0.76, 0.16, 130], [0.7, 0.13, 154], [0.72, 0.16, 138]],
  leaf: [[0.66, 0.15, 144], [0.76, 0.16, 132], [0.7, 0.14, 152]],
  sunflower: [[0.82, 0.14, 92], [0.74, 0.14, 76], [0.88, 0.13, 100], [0.72, 0.13, 66]],
  wildflower: [[0.74, 0.16, 344], [0.84, 0.13, 92], [0.72, 0.13, 232], [0.76, 0.15, 26], [0.72, 0.15, 150]],
  neutrals: [[0.72, 0.014, 250], [0.82, 0.01, 250], [0.9, 0.008, 90], [0.78, 0.012, 250]],
  // charcoal is the one word that must stay dark; held well below the slate field for downward
  // contrast (no background chip — a light cream halo on each letter does the separating)
  charcoal: [[0.27, 0.02, 252], [0.34, 0.022, 252], [0.24, 0.018, 252], [0.31, 0.02, 252]],
  cream: [[0.92, 0.03, 82], [0.88, 0.035, 70], [0.94, 0.02, 92]],
  cardinal: [[0.62, 0.2, 26], [0.66, 0.2, 16], [0.6, 0.19, 32], [0.68, 0.18, 20]],
  snow: [[0.93, 0.02, 232], [0.9, 0.035, 220], [0.95, 0.015, 245]],
  poppy: [[0.66, 0.2, 34], [0.64, 0.21, 26], [0.7, 0.19, 44], [0.62, 0.18, 20]],
  honeycomb: [[0.82, 0.13, 84], [0.76, 0.14, 72], [0.88, 0.11, 92], [0.74, 0.13, 64]],
  nautilus: [[0.74, 0.11, 44], [0.8, 0.1, 56], [0.7, 0.12, 32], [0.78, 0.1, 26]],
  fern: [[0.64, 0.14, 148], [0.74, 0.16, 136], [0.68, 0.14, 158], [0.78, 0.15, 130]],
  // the white-silver ratio (hakugin-hi): crimson + cream, the hinomaru read without the cliché
  hakugin: [[0.62, 0.2, 22], [0.92, 0.025, 80], [0.6, 0.2, 18], [0.9, 0.03, 84]],
  // a nebula sweep: violet → magenta → deep blue → cyan → a pale star, for "cosmic"
  cosmic: [[0.66, 0.17, 300], [0.72, 0.17, 338], [0.6, 0.16, 268], [0.74, 0.13, 222], [0.86, 0.05, 250]],
}

/** True when a word (case-insensitive) has a dedicated letter ramp. */
export function hasTint(word: string): boolean {
  return WORD_RAMPS[word.trim().toLowerCase()] !== undefined
}

/** `n` solid OKLCH colors stepped across a word's ramp; an unknown word falls back to the `nature`
 * ramp so it is still painted (never undefined-per-letter). */
function wordColors(key: string, n: number): string[] {
  const stops = WORD_RAMPS[key] ?? PALETTES.nature
  if (n <= 1) {
    const s = stops[0]
    return [`oklch(${clampL(s[0])} ${s[1]} ${s[2]})`]
  }
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const pos = (i / (n - 1)) * (stops.length - 1)
    const idx = Math.min(stops.length - 2, Math.floor(pos))
    const f = pos - idx
    const a = stops[idx]
    const b = stops[idx + 1]
    out.push(`oklch(${clampL(lerp(a[0], b[0], f)).toFixed(3)} ${lerp(a[1], b[1], f).toFixed(3)} ${lerpHue(a[2], b[2], f).toFixed(1)})`)
  }
  return out
}

/**
 * A natural word painted letter by letter in the colors of the thing it names. The visible text is
 * `children`; an optional `ramp` key overrides the lookup (so "leaf venation" and a Japanese term
 * can borrow a ramp whose key differs from the displayed text). Spaces stay uncolored; the color
 * index counts only letters so the ramp is even across the word.
 */
/** words painted in deliberately DARK colors; they get a soft CREAM halo (not a background chip,
 * which would read as a highlight) so the dark glyphs separate from the slate without shouting. */
const DARK_WORDS = new Set(['charcoal'])

export function TintWord({
  children,
  ramp,
  style,
}: {
  children: string
  ramp?: string
  style?: React.CSSProperties
}) {
  const key = (ramp ?? children).trim().toLowerCase()
  const letters = Array.from(children)
  const colors = wordColors(key, letters.filter((c) => c !== ' ').length)
  // a tight halo lifts any letter off the slate without a box: a dark halo for light/mid colors,
  // a cream halo for the few genuinely dark words so they read by edge, not by highlight
  const halo = DARK_WORDS.has(key)
    ? '0 0 2px rgba(244,240,232,0.55), 0 0 1px rgba(244,240,232,0.7)'
    : '0 1px 1.5px rgba(20,22,25,0.45)'
  let ci = 0
  return (
    <span aria-label={children} data-tint={key} style={style}>
      {letters.map((ch, i) =>
        ch === ' ' ? ' ' : (
          <span key={i} aria-hidden style={{ color: colors[ci++], textShadow: halo }}>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
