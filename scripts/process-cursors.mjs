// Turn the magenta-background cursor sprites into CRISP pixel-art cursor PNGs with hotspots.
// Instead of downscaling the smooth/upscaled source (which feathers the edges), this recovers the
// source's NATIVE pixel grid: detect the upscale pitch, sample each cell's center, snap to flat
// {fill, outline} colors, and render at an integer scale with nearest-neighbour. Sharp by design.
//   node scripts/process-cursors.mjs
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'cursors')

const FILL = [0xb8, 0x6b, 0x4b] // #B86B4B
const OUTLINE = [0x2f, 0x2f, 0x2f] // #2f2f2f
const RENDER_SCALE = 1

// ---------- PNG decode (8-bit RGB/RGBA) ----------
function decodePng(buf) {
  let pos = 8
  const chunks = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    chunks.push({ type, data: buf.subarray(pos + 8, pos + 8 + len) })
    pos += 12 + len
  }
  const ihdr = chunks.find((c) => c.type === 'IHDR').data
  const w = ihdr.readUInt32BE(0)
  const h = ihdr.readUInt32BE(4)
  const colorType = ihdr[9]
  const bpp = colorType === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)))
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const ft = raw[p++]
    for (let x = 0; x < stride; x++) {
      const v = raw[p++]
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let r
      switch (ft) {
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break }
        default: r = v
      }
      out[y * stride + x] = r & 0xff
    }
  }
  return { w, h, bpp, data: out }
}

// ---------- PNG encode (8-bit RGBA) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc32(body), 0); return Buffer.concat([l, body, cc]) }
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const stride = w * 4
  const f = Buffer.alloc(h * (stride + 1))
  for (let y = 0; y < h; y++) { f[y * (stride + 1)] = 0; Buffer.from(rgba.buffer, y * stride, stride).copy(f, y * (stride + 1) + 1) }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(f, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// pixel kind at source (x,y): 0 transparent (magenta/shadow), 1 fill, 2 outline
function classify(img, x, y) {
  const { data, w, bpp } = img
  const i = (y * w + x) * bpp
  const r = data[i], g = data[i + 1], b = data[i + 2]
  if (b - g > 60) return 0 // magenta-ish (background + its shadow): blue dominates green
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum < 96 ? 2 : 1 // dark -> outline, else -> warm fill
}

// content bbox (non-background)
function bbox(img) {
  const { w, h } = img
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (classify(img, x, y) !== 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  return { x0, y0, x1, y1 }
}

// detect the upscale pitch (px per native pixel) from run-lengths of the classified rows/cols
function detectPitch(img, bb) {
  const runs = []
  const sample = (a, b, get) => { let i = a; while (i < b) { const v = get(i); let n = 1; while (i + n < b && get(i + n) === v) n++; if (i > a && i + n < b) runs.push(n); i += n } }
  for (let y = bb.y0; y <= bb.y1; y += 3) sample(bb.x0, bb.x1 + 1, (x) => classify(img, x, y))
  for (let x = bb.x0; x <= bb.x1; x += 3) sample(bb.y0, bb.y1 + 1, (y) => classify(img, x, y))
  const filtered = runs.filter((r) => r >= 6).sort((a, b) => a - b)
  // 8th-percentile run ≈ one native pixel (robust against the odd 2-px feature / AA noise)
  return filtered[Math.floor(filtered.length * 0.08)] || 40
}

function process(srcFile, outName, mode) {
  const img = decodePng(fs.readFileSync(path.join(ROOT, 'sprites', srcFile)))
  const bb = bbox(img)
  const pitch = detectPitch(img, bb)
  const gw = Math.max(1, Math.round((bb.x1 - bb.x0 + 1) / pitch))
  const gh = Math.max(1, Math.round((bb.y1 - bb.y0 + 1) / pitch))
  // sample each native cell's center
  const grid = new Uint8Array(gw * gh)
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const sx = Math.min(img.w - 1, Math.round(bb.x0 + (gx + 0.5) * pitch))
      const sy = Math.min(img.h - 1, Math.round(bb.y0 + (gy + 0.5) * pitch))
      grid[gy * gw + gx] = classify(img, sx, sy)
    }

  // ASCII preview (for verification)
  let ascii = ''
  for (let gy = 0; gy < gh; gy++) { for (let gx = 0; gx < gw; gx++) { const k = grid[gy * gw + gx]; ascii += k === 0 ? ' ' : k === 2 ? '#' : '.' } ascii += '\n' }

  // render at integer scale (nearest) -> RGBA
  const S = RENDER_SCALE
  const W = gw * S, H = gh * S
  const rgba = new Uint8Array(W * H * 4)
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const k = grid[gy * gw + gx]
      if (k === 0) continue
      const col = k === 2 ? OUTLINE : FILL
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const i = ((gy * S + sy) * W + (gx * S + sx)) * 4
          rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2]; rgba[i + 3] = 255
        }
    }

  // hotspot in NATIVE-grid coords, scaled: topmost opaque row; arrow=leftmost, hand=run center
  let hot = { x: 0, y: 0 }
  outer: for (let gy = 0; gy < gh; gy++) {
    let lo = -1, hi = -1
    for (let gx = 0; gx < gw; gx++) if (grid[gy * gw + gx] !== 0) { if (lo < 0) lo = gx; hi = gx }
    if (lo >= 0) { hot = { x: (mode === 'arrow' ? lo : Math.round((lo + hi) / 2)) * S, y: gy * S }; break outer }
  }

  fs.writeFileSync(path.join(OUT_DIR, outName), encodePng(W, H, rgba))
  console.log(`\n${outName}: pitch≈${pitch}px  native ${gw}x${gh}  out ${W}x${H}  hotspot ${hot.x} ${hot.y}\n${ascii}`)
  return { name: outName, w: W, h: H, hot }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const arrow = process('chickpea-cursor.png', 'arrow.png', 'arrow')
const hand = process('chickpea-cursor-click.png', 'hand.png', 'hand')
console.log('CSS:')
console.log(`  default: url('/cursors/arrow.png') ${arrow.hot.x} ${arrow.hot.y}, auto`)
console.log(`  pointer: url('/cursors/hand.png') ${hand.hot.x} ${hand.hot.y}, pointer`)
