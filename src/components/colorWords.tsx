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
function naturePalette(kind: NatureKind, n: number, lighten = 0): string[] {
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
