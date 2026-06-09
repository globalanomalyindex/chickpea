/**
 * Perceptually-uniform color core: OKLab / OKLCH ⇄ sRGB, with hue-preserving gamut mapping.
 *
 * OKLCH is OKLab (Björn Ottosson's perceptual space) in cylindrical form: L = lightness 0..1,
 * C = chroma (colorfulness) 0..~0.37, H = hue in degrees. Unlike HSL, equal numeric steps look
 * like equal perceptual steps — a 0.1 jump in L is the same visual change at every hue, and two
 * colors at the same L genuinely read as equally light. That is why every palette recipe reasons
 * in OKLCH and only converts to sRGB at the very end: harmony and legibility math is honest here.
 *
 * The catch is that OKLCH can describe colors sRGB cannot show (it is a bigger space). The fix is
 * `gamutMapToRgb`: when a color is out of gamut, hold L and H fixed and reduce only C until it
 * fits. Desaturating toward the in-gamut boundary preserves the color's lightness and hue — the
 * two things the eye is most sensitive to — instead of the hard RGB clip that shifts both. This is
 * what makes "the palette always works": no recipe can ever emit something that renders wrong.
 */

export interface Oklch {
  L: number
  C: number
  H: number
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)

// ---- sRGB transfer (companding) ----
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

// ---- linear sRGB ⇄ OKLab (Ottosson matrices) ----
function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}
function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

// ---- OKLCH ⇄ OKLab ----
/** OKLCH → OKLab as [L, a, b]. H is in degrees. */
export function oklchToOklab(c: Oklch): [number, number, number] {
  const hr = (c.H * Math.PI) / 180
  return [c.L, c.C * Math.cos(hr), c.C * Math.sin(hr)]
}

/** Raw (unclamped) linear-sRGB triple for an OKLCH color — may fall outside [0,1]. */
function oklchToLinear(c: Oklch): [number, number, number] {
  const [L, a, b] = oklchToOklab(c)
  return oklabToLinearSrgb(L, a, b)
}

const GAMUT_EPS = 1e-4
function linearInGamut([r, g, b]: [number, number, number]): boolean {
  return (
    r >= -GAMUT_EPS && r <= 1 + GAMUT_EPS &&
    g >= -GAMUT_EPS && g <= 1 + GAMUT_EPS &&
    b >= -GAMUT_EPS && b <= 1 + GAMUT_EPS
  )
}

/** True iff this OKLCH color is representable in sRGB. */
export function inGamut(c: Oklch): boolean {
  return linearInGamut(oklchToLinear(c))
}

/**
 * Map an OKLCH color into sRGB as an integer [r,g,b] (0..255). If the color is already in gamut it
 * is converted directly; otherwise L and H are held fixed and C is reduced (binary search) to the
 * largest in-gamut chroma, so hue and lightness survive. A final clamp absorbs the ±epsilon slack.
 */
export function gamutMapToRgb(c: Oklch): [number, number, number] {
  const L = clamp01(c.L)
  let C = Math.max(0, c.C)
  if (!linearInGamut(oklchToLinear({ L, C, H: c.H }))) {
    let lo = 0
    let hi = C
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (linearInGamut(oklchToLinear({ L, C: mid, H: c.H }))) lo = mid
      else hi = mid
    }
    C = lo
  }
  const lin = oklchToLinear({ L, C, H: c.H })
  return lin.map((v) => Math.round(clamp01(linearToSrgb(clamp01(v))) * 255)) as unknown as [number, number, number]
}

/**
 * Largest in-gamut chroma for a given lightness and hue (binary search). Lets the procedural
 * sampler request chroma as a FRACTION of the available headroom, so a color rarely needs gamut
 * clamping afterward — intent ≈ render. Returns 0 for near-black/near-white where no chroma fits.
 */
export function maxChroma(L: number, H: number): number {
  const Lc = L < 0 ? 0 : L > 1 ? 1 : L
  if (!linearInGamut(oklchToLinear({ L: Lc, C: 0.002, H }))) return 0
  let lo = 0
  let hi = 0.5
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (linearInGamut(oklchToLinear({ L: Lc, C: mid, H: H }))) lo = mid
    else hi = mid
  }
  return lo
}

/** Convert sRGB [r,g,b] (0..255) into OKLCH. */
export function rgbToOklch([r, g, b]: [number, number, number]): Oklch {
  const [L, a, bb] = linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255))
  let H = (Math.atan2(bb, a) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C: Math.hypot(a, bb), H }
}

/** Perceptual (OKLab) distance between two OKLCH colors — a small ΔE means "looks the same". */
export function deltaE(a: Oklch, b: Oklch): number {
  const A = oklchToOklab(a)
  const B = oklchToOklab(b)
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
}
