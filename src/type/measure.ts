/** Reference glyph size for squeeze-fit measurement. All fits are computed at this size, then scaled. */
export const REF_SIZE = 100

let _ctx: CanvasRenderingContext2D | null = null
let _cache = new Map<string, number>()

/** Memoized offscreen 2D context for measureText. Created lazily (browser only). */
function ctx(): CanvasRenderingContext2D | null {
  if (_ctx) return _ctx
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  _ctx = c.getContext('2d')
  if (_ctx) _ctx.font = `${REF_SIZE}px Mafinest`
  return _ctx
}

/**
 * Intrinsic width of a line at REF_SIZE in Mafinest, via offscreen measureText.
 * Memoized at module scope. Falls back to a glyph-count estimate when no canvas
 * (e.g. SSR / non-DOM) so the math stays defined.
 */
export function measureLine(line: string): number {
  const cached = _cache.get(line)
  if (cached !== undefined) return cached
  const c = ctx()
  const w = c ? c.measureText(line).width : line.length * REF_SIZE * 0.55
  _cache.set(line, w)
  return w
}
