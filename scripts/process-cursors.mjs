// Turn the magenta-background cursor sprites into clean, transparent, correctly-sized cursor PNGs
// with computed hotspots. Dependency-free (hand-rolled PNG decode/encode). No magenta, sharp edges.
//   node scripts/process-cursors.mjs
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'cursors')

const TARGET_H = 44 // cropped cursor height in px — noticeably larger than a standard ~24px cursor

// ---------- PNG decode ----------
function readChunks(buf) {
  let pos = 8 // skip signature
  const chunks = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    chunks.push({ type, data })
    pos += 12 + len
  }
  return chunks
}

function decodePng(buf) {
  const chunks = readChunks(buf)
  const ihdr = chunks.find((c) => c.type === 'IHDR').data
  const w = ihdr.readUInt32BE(0)
  const h = ihdr.readUInt32BE(4)
  const bitDepth = ihdr[8]
  const colorType = ihdr[9] // 2=RGB, 6=RGBA
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG: depth ${bitDepth}, colorType ${colorType}`)
  }
  const bpp = colorType === 6 ? 4 : 3
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data))
  const raw = zlib.inflateSync(idat)
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  let pos = 0
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++]
    for (let x = 0; x < stride; x++) {
      const v = raw[pos++]
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let r
      switch (ft) {
        case 0: r = v; break
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default: r = v
      }
      out[y * stride + x] = r & 0xff
    }
  }
  // expand to RGBA
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = out[i * bpp]
    rgba[i * 4 + 1] = out[i * bpp + 1]
    rgba[i * 4 + 2] = out[i * bpp + 2]
    rgba[i * 4 + 3] = bpp === 4 ? out[i * bpp + 3] : 255
  }
  return { w, h, rgba }
}

// ---------- PNG encode (8-bit RGBA) ----------
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = w * 4
  const filtered = Buffer.alloc(h * (stride + 1))
  for (let y = 0; y < h; y++) {
    filtered[y * (stride + 1)] = 0
    Buffer.from(rgba.buffer, y * stride, stride).copy(filtered, y * (stride + 1) + 1)
  }
  const idat = zlib.deflateSync(filtered, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---------- keying: remove magenta (incl. its drop shadow) + de-fringe edges ----------
function keyMagenta(img) {
  const { w, h, rgba } = img
  // background = the corner color (magenta)
  const bg = [rgba[0], rgba[1], rgba[2]]
  // "magenta-ness" = how much blue exceeds green. Brown fill has B<G (negative); dark outline ~0;
  // pure + shadowed magenta both have B>>G. A soft band gives a clean anti-aliased alpha.
  const LO = 24 // <= LO  -> fully cursor
  const HI = 110 // >= HI -> fully background
  const out = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]
    const m = b - g
    let a
    if (m <= LO) a = 1
    else if (m >= HI) a = 0
    else a = 1 - (m - LO) / (HI - LO)
    const o = i * 4
    if (a <= 0) {
      out[o + 3] = 0
    } else if (a >= 1) {
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255
    } else {
      // de-fringe: recover foreground F from C = a*F + (1-a)*bg
      out[o] = Math.max(0, Math.min(255, Math.round((r - (1 - a) * bg[0]) / a)))
      out[o + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - a) * bg[1]) / a)))
      out[o + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - a) * bg[2]) / a)))
      out[o + 3] = Math.round(a * 255)
    }
  }
  return { w, h, rgba: out }
}

// ---------- autocrop to the opaque bbox ----------
function autocrop(img, alphaMin = 16) {
  const { w, h, rgba } = img
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (rgba[(y * w + x) * 4 + 3] >= alphaMin) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const out = new Uint8Array(cw * ch * 4)
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const s = ((y + y0) * w + (x + x0)) * 4
      const d = (y * cw + x) * 4
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3]
    }
  return { w: cw, h: ch, rgba: out }
}

// ---------- area-average downscale (premultiplied alpha, no color bleed) ----------
function resizeTo(img, dh) {
  const { w: sw, h: sh, rgba } = img
  const scale = dh / sh
  const dw = Math.max(1, Math.round(sw * scale))
  const out = new Uint8Array(dw * dh * 4)
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      const x0 = Math.floor((dx * sw) / dw)
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * sw) / dw))
      const y0 = Math.floor((dy * sh) / dh)
      const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * sh) / dh))
      let R = 0, G = 0, B = 0, A = 0, n = 0
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * sw + x) * 4
          const a = rgba[i + 3] / 255
          R += rgba[i] * a; G += rgba[i + 1] * a; B += rgba[i + 2] * a; A += rgba[i + 3]; n++
        }
      const i = (dy * dw + dx) * 4
      if (A > 0) {
        const aw = A / 255
        out[i] = Math.round(R / aw); out[i + 1] = Math.round(G / aw); out[i + 2] = Math.round(B / aw); out[i + 3] = Math.round(A / n)
      } else out[i + 3] = 0
    }
  }
  return { w: dw, h: dh, rgba: out }
}

// ---------- hotspot: topmost opaque row; x = (arrow) leftmost opaque, (hand) center of run ----------
function hotspot(img, mode) {
  const { w, h, rgba } = img
  for (let y = 0; y < h; y++) {
    let lo = -1, hi = -1
    for (let x = 0; x < w; x++)
      if (rgba[(y * w + x) * 4 + 3] >= 80) {
        if (lo < 0) lo = x
        hi = x
      }
    if (lo >= 0) return mode === 'arrow' ? { x: lo, y } : { x: Math.round((lo + hi) / 2), y }
  }
  return { x: 0, y: 0 }
}

// ---------- run ----------
function process(srcFile, outName, mode) {
  const img = decodePng(fs.readFileSync(path.join(ROOT, 'sprites', srcFile)))
  const keyed = keyMagenta(img)
  const cropped = autocrop(keyed)
  const sized = resizeTo(cropped, TARGET_H)
  const hot = hotspot(sized, mode)
  fs.writeFileSync(path.join(OUT_DIR, outName), encodePng(sized.w, sized.h, sized.rgba))
  console.log(`${outName}  ${sized.w}x${sized.h}  hotspot ${hot.x} ${hot.y}`)
  return { name: outName, w: sized.w, h: sized.h, hot }
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const arrow = process('chickpea-cursor.png', 'arrow.png', 'arrow')
const hand = process('chickpea-cursor-click.png', 'hand.png', 'hand')
console.log('\nCSS:')
console.log(`  default: url('/cursors/arrow.png') ${arrow.hot.x} ${arrow.hot.y}, auto`)
console.log(`  pointer: url('/cursors/hand.png') ${hand.hot.x} ${hand.hot.y}, pointer`)
