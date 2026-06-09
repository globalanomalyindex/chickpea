/**
 * "Reveal math" export — the grid skeleton as a true PNG WITH ALPHA.
 *
 * The background is never painted (a 2D context starts fully transparent and toBlob('image/png')
 * keeps the alpha channel), so the export drops cleanly over any artwork. GRID LINES are always
 * drawn — module outlines + the full-span guide construction lines, the persistent skeleton.
 * ANNOTATIONS (a ratio legend, the dominant module's measured dimensions, and per-cut proportion
 * labels) are layered only when `annotate` is true. Everything is a single ink colour (the studio's
 * current light/dark choice); because the PNG composites over an unknown background, each label gets
 * a translucent counter-tone halo so it stays legible on light OR dark.
 *
 * Mirrors export-png.ts: supersample at `scale`, then downsample for crisp hairlines + clean text.
 */

import type { Grid } from '../grid/types'
import type { CutRef } from '../grid/tree'
import { snapToRatio, ratioName } from '../grid/anchor'

export const LIGHT_INK = '#f4f0e8'
export const DARK_INK = '#2a2e31'

export interface SkeletonPngOpts {
  width: number
  height: number
  /** line + label colour — the studio's current reveal ink. */
  ink: string
  /** draw the optional annotation layer (legend, dimensions, proportion labels). */
  annotate: boolean
  /** internal supersample factor; output is downsampled to width×height. */
  scale?: number
}

const MONO = "12px ui-monospace, 'SF Mono', Menlo, monospace"
const counterTone = (ink: string): string => (ink.toLowerCase() === DARK_INK ? LIGHT_INK : DARK_INK)

interface Box {
  x: number
  y: number
  w: number
  h: number
}
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/** Text with a translucent counter-tone halo so it reads on any background, then the ink fill. */
function inkText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  align: CanvasTextAlign,
  s: number,
): void {
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = counterTone(ink)
  ctx.lineWidth = 3 * s
  ctx.strokeText(text, x, y)
  ctx.globalAlpha = 1
  ctx.fillStyle = ink
  ctx.fillText(text, x, y)
}

/** A double-headed dimension arrow between (x1,y1) and (x2,y2) with a centered label. */
function dimArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, label: string, ink: string, s: number): void {
  const head = 5 * s
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  ctx.strokeStyle = ink
  ctx.lineWidth = 1.2 * s
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const arrow = (px: number, py: number, dir: number) => {
    ctx.beginPath()
    if (vertical) {
      ctx.moveTo(px - head, py + dir * head)
      ctx.lineTo(px, py)
      ctx.lineTo(px + head, py + dir * head)
    } else {
      ctx.moveTo(px + dir * head, py - head)
      ctx.lineTo(px, py)
      ctx.lineTo(px + dir * head, py + head)
    }
    ctx.stroke()
  }
  arrow(x1, y1, 1)
  arrow(x2, y2, -1)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  inkText(ctx, label, vertical ? mx + 8 * s : mx, vertical ? my : my - 8 * s, ink, 'center', s)
}

/**
 * Rasterize the grid skeleton (+ optional annotations) to a transparent PNG Blob.
 * Pure aside from canvas/Blob; deterministic for a given (grid, opts) — label placement uses a
 * stable priority order, not RNG, so the same input yields the same bytes.
 */
export async function gridSkeletonToPngBlob(grid: Grid, opts: SkeletonPngOpts): Promise<Blob> {
  const { width, height, ink, annotate, scale = 2 } = opts
  const W = Math.round(width * scale)
  const H = Math.round(height * scale)

  const big = document.createElement('canvas')
  big.width = W
  big.height = H
  const ctx = big.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  // NB: never fillRect a background — the canvas starts transparent and we keep it that way (alpha).
  ctx.font = MONO

  const px = (v: number): number => Math.round(v) + 0.5 // device-pixel-crisp hairline

  // (1) module outlines — ALWAYS
  ctx.strokeStyle = ink
  ctx.globalAlpha = 0.5
  ctx.lineWidth = Math.max(1, scale)
  for (const m of grid.modules) {
    ctx.strokeRect(px(m.x * W), px(m.y * H), Math.round(m.w * W), Math.round(m.h * H))
  }

  // (2) full-span guide construction lines — ALWAYS
  ctx.globalAlpha = 0.62
  ctx.lineWidth = Math.max(1, 1.4 * scale)
  ctx.beginPath()
  for (const g of grid.guides) {
    if (g.axis === 'v') {
      ctx.moveTo(px(g.pos * W), 0)
      ctx.lineTo(px(g.pos * W), H)
    } else {
      ctx.moveTo(0, px(g.pos * H))
      ctx.lineTo(W, px(g.pos * H))
    }
  }
  ctx.stroke()
  ctx.globalAlpha = 1

  if (annotate) {
    const reserved: Box[] = []
    const fits = (b: Box): boolean => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H && !reserved.some((r) => overlaps(r, b))
    const labelW = (t: string): number => ctx.measureText(t).width
    const lineH = 16 * scale
    const pad = 10 * scale

    // (3) ratio legend, top-left — the distinct proportions in play
    const legend = grid.ratios.slice(0, 4).map((r) => `${r.name} ${r.value.toFixed(3)}`)
    let ly = pad + lineH / 2
    for (const entry of legend) {
      const b: Box = { x: pad, y: ly - lineH / 2, w: labelW(entry) + 4 * scale, h: lineH }
      reserved.push(b)
      inkText(ctx, entry, pad, ly, ink, 'left', scale)
      ly += lineH
    }

    // (4) dominant module's measured width + height, in TRUE exported px (not supersampled)
    const dom = grid.modules.reduce((p, c) => (c.w * c.h > p.w * p.h ? c : p), grid.modules[0])
    if (dom) {
      const inset = 8 * scale
      dimArrow(ctx, px(dom.x * W), px((dom.y + dom.h) * H + inset), px((dom.x + dom.w) * W), px((dom.y + dom.h) * H + inset), `${Math.round(dom.w * width)}`, ink, scale)
      dimArrow(ctx, px((dom.x + dom.w) * W + inset), px(dom.y * H), px((dom.x + dom.w) * W + inset), px((dom.y + dom.h) * H), `${Math.round(dom.h * height)}`, ink, scale)
      reserved.push({ x: dom.x * W, y: (dom.y + dom.h) * H, w: dom.w * W, h: 20 * scale })
    }

    // (5) per-cut proportion labels on the major guides (longest first), truthful + collision-free
    const cuts = ((grid.meta?.cuts as CutRef[] | undefined) ?? [])
      .map((c) => ({ c, span: c.hi - c.lo }))
      .sort((a, b) => b.span - a.span)
    let placed = 0
    for (const { c } of cuts) {
      if (placed >= 8) break
      const snapped = snapToRatio(c.frac)
      if (Math.abs(c.frac - snapped) > 0.012) continue // only label clean, truthful ratios
      const text = ratioName(snapped)
      const tw = labelW(text) + 4 * scale
      // candidate anchors along the guide (start, then 30%/70%), small perpendicular offset
      const anchors: Box[] =
        c.axis === 'v'
          ? [0.06, 0.3, 0.7, 0.94].map((t) => ({ x: c.pos * W - tw / 2, y: t * H - lineH / 2, w: tw, h: lineH }))
          : [0.06, 0.3, 0.7, 0.94].map((t) => ({ x: t * W - tw / 2, y: c.pos * H - lineH / 2, w: tw, h: lineH }))
      const spot = anchors.find(fits)
      if (!spot) continue
      reserved.push(spot)
      inkText(ctx, text, spot.x + spot.w / 2, spot.y + spot.h / 2, ink, 'center', scale)
      placed++
    }
  }

  // downsample to target size for crisp edges
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
