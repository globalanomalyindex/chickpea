import type { Grid } from '../grid/types'
import type { Composition } from '../studio/composition'
import { fitText } from '../type/typography-fit'
import { measureLine, REF_SIZE } from '../type/measure'
import { hexToRgb, luminance } from '../palette/hsl'

export interface PngExportOpts {
  width: number
  height: number
  /** internal supersample factor; output is downsampled to width×height. */
  scale?: number
}

const LIGHT_INK = '#f4f0e8'
const DARK_INK = '#2a2e31'
const TEXT_PAD = 0.14

function inkFor(hex: string): string {
  return luminance(hexToRgb(hex)) < 0.42 ? LIGHT_INK : DARK_INK
}

/** Draw a composition into a 2D context whose box is [0,0,W,H] (device px). */
function drawComposition(ctx: CanvasRenderingContext2D, composition: Composition, W: number, H: number) {
  // background
  ctx.fillStyle = composition.background
  ctx.fillRect(0, 0, W, H)

  // module fills
  for (const cm of composition.modules) {
    const m = cm.module
    ctx.fillStyle = cm.color
    ctx.fillRect(m.x * W, m.y * H, m.w * W, m.h * H)
  }

  // squeeze-fit text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const cm of composition.modules) {
    if (!cm.text) continue
    const m = cm.module
    const fit = fitText({
      text: cm.text,
      width: m.w * W,
      height: m.h * H,
      measure: measureLine,
      refSize: REF_SIZE,
      lineHeight: 1,
      padding: TEXT_PAD,
    })
    ctx.fillStyle = inkFor(cm.color)
    const innerH = m.h * H * (1 - 2 * TEXT_PAD)
    const padY = (m.h * H - innerH) / 2
    const lineCount = fit.lines.length
    fit.lines.forEach((ln, i) => {
      const bandH = innerH / lineCount
      const cy = m.y * H + padY + bandH * (i + 0.5)
      const cx = m.x * W + m.w * W / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(ln.scaleX, ln.scaleY)
      ctx.font = `${REF_SIZE}px Mafinest`
      ctx.fillText(ln.text, 0, 0)
      ctx.restore()
    })
  }
}

/**
 * Rasterize a Composition to a PNG Blob via an offscreen canvas at 2× (default),
 * downsampled to width×height for crisp edges and antialiased type.
 */
export async function compositionToPngBlob(
  composition: Composition,
  _grid: Grid,
  opts: PngExportOpts,
): Promise<Blob> {
  const { width, height, scale = 2 } = opts
  const W = Math.round(width * scale)
  const H = Math.round(height * scale)

  const big = document.createElement('canvas')
  big.width = W
  big.height = H
  const bctx = big.getContext('2d')
  if (!bctx) throw new Error('2D canvas unavailable')
  drawComposition(bctx, composition, W, H)

  // downsample to target size
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const octx = out.getContext('2d')
  if (!octx) throw new Error('2D canvas unavailable')
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(big, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
