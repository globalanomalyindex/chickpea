export interface LoadedImage {
  /** downsized opaque pixels as [r,g,b] triples (fully transparent pixels skipped). */
  pixels: [number, number, number][]
  /** downsized sample grid dimensions. */
  width: number
  height: number
  /** full-resolution data URL for display in the bisection canvas. */
  dataUrl: string
}

/** Read a File into a data URL (used for both decoding and display). */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

/** Decode a data URL into an HTMLImageElement. */
function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

/**
 * Load an image file → a downsized RGB pixel sample (for k-means) plus a full-res data URL
 * (for display). The image is drawn to an offscreen canvas scaled so its longest side is
 * ≤ `maxDim`, then `getImageData` is read and collected into `[r,g,b]` triples, skipping
 * fully transparent pixels. Dependency-free; browser-only (needs canvas + Image).
 */
export async function loadImagePixels(
  file: File,
  maxDim = 96,
): Promise<LoadedImage> {
  const dataUrl = await fileToDataUrl(file)
  const img = await loadImageEl(dataUrl)

  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const longest = Math.max(srcW, srcH) || 1
  const scale = Math.min(1, maxDim / longest)
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(img, 0, 0, width, height)

  const { data } = ctx.getImageData(0, 0, width, height)
  const pixels: [number, number, number][] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue // skip fully transparent
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }

  return { pixels, width, height, dataUrl }
}
