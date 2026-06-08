import type { Grid } from '../grid/types'
import type { Composition } from '../studio/composition'
import { fitText } from '../type/typography-fit'
import { measureLine, REF_SIZE } from '../type/measure'
import { hexToRgb, luminance } from '../palette/hsl'

export interface SvgExportOpts {
  width: number
  height: number
  includeGrid?: boolean
  /** base64 data URL for the Mafinest otf, embedded as @font-face when present. */
  fontDataUrl?: string
}

const LIGHT_INK = '#f4f0e8'
const DARK_INK = '#2a2e31'
const TEXT_PAD = 0.14
const GUIDE_W = 0.0015

function inkFor(hex: string): string {
  return luminance(hexToRgb(hex)) < 0.42 ? LIGHT_INK : DARK_INK
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function n(v: number): string {
  // compact, deterministic numbers
  return Number(v.toFixed(6)).toString()
}

/**
 * Render a Composition to a standalone SVG document string (sync, pure).
 * Coordinates live in a 0..1 viewBox; export dims set width/height. Optional grid
 * hairlines and a base64 @font-face for Mafinest (supplied by the caller, fetched once).
 */
export function compositionToSvg(composition: Composition, grid: Grid, opts: SvgExportOpts): string {
  const { width, height, includeGrid = false, fontDataUrl } = opts
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" ` +
      `viewBox="0 0 1 1" preserveAspectRatio="none">`,
  )
  parts.push(`<title>Chickpea</title>`)
  parts.push(`<desc>Made with Chickpea · ${grid.generator} · seed ${grid.seed}</desc>`)

  if (fontDataUrl) {
    parts.push(
      `<defs><style type="text/css">@font-face{font-family:'Mafinest';` +
        `src:url('${fontDataUrl}') format('opentype');font-weight:400;font-style:normal;}</style></defs>`,
    )
  }

  // background
  parts.push(`<rect x="0" y="0" width="1" height="1" fill="${composition.background}"/>`)

  // module fills
  for (const cm of composition.modules) {
    const m = cm.module
    parts.push(`<rect x="${n(m.x)}" y="${n(m.y)}" width="${n(m.w)}" height="${n(m.h)}" fill="${cm.color}"/>`)
  }

  // optional grid hairlines
  if (includeGrid) {
    for (const g of grid.guides) {
      parts.push(
        g.axis === 'v'
          ? `<line x1="${n(g.pos)}" y1="0" x2="${n(g.pos)}" y2="1" stroke="${LIGHT_INK}" stroke-opacity="0.5" stroke-width="${GUIDE_W}"/>`
          : `<line x1="0" y1="${n(g.pos)}" x2="1" y2="${n(g.pos)}" stroke="${LIGHT_INK}" stroke-opacity="0.5" stroke-width="${GUIDE_W}"/>`,
      )
    }
  }

  // squeeze-fit text
  for (const cm of composition.modules) {
    if (!cm.text) continue
    const m = cm.module
    const fit = fitText({
      text: cm.text,
      width: m.w,
      height: m.h,
      measure: measureLine,
      refSize: REF_SIZE,
      lineHeight: 1,
      padding: TEXT_PAD,
    })
    const ink = inkFor(cm.color)
    const innerH = m.h * (1 - 2 * TEXT_PAD)
    const padY = (m.h - innerH) / 2
    const lineCount = fit.lines.length
    fit.lines.forEach((ln, i) => {
      const bandH = innerH / lineCount
      const cy = m.y + padY + bandH * (i + 0.5)
      const cx = m.x + m.w / 2
      parts.push(
        `<text transform="translate(${n(cx)} ${n(cy)}) scale(${n(ln.scaleX)} ${n(ln.scaleY)})" ` +
          `font-family="Mafinest, Georgia, serif" font-size="${REF_SIZE}" fill="${ink}" ` +
          `text-anchor="middle" dominant-baseline="central">${esc(ln.text)}</text>`,
      )
    })
  }

  parts.push(`</svg>`)
  return parts.join('')
}

/** Fetch the vendored Mafinest otf and return it as a base64 data URL (cached). */
let _fontCache: Promise<string> | null = null
export function loadMafinestDataUrl(): Promise<string> {
  if (_fontCache) return _fontCache
  _fontCache = fetch('/fonts/Mafinest-Regular.otf')
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }),
    )
  return _fontCache
}
