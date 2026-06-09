import { useCallback, useMemo, useRef, useState } from 'react'
import type { Cut } from '../grid/anchor'
import type { Axis } from '../grid/types'
import { loadImagePixels } from '../io/image-io'
import { kmeans, type ColorWeight } from '../palette/kmeans'
import { dyadicLayout } from '../palette/dyadic-layout'
import { rgbToHex } from '../palette/hsl'
import { entryEdge, axisForEdge, type Point } from '../bisection/cursor-axis-detector'

const CREAM = '#f4f0e8'
const STEEL = '#4e6a7a'
const SLATE_INK = '#2a2e31'
const HAIR = 'rgba(244,240,232,0.22)'
const PALETTE_K = 6

interface Props {
  onCommit: (cuts: Cut[], palette: ColorWeight[], dataUrl: string, aspect: number) => void
  /** optional initial state when re-bisecting an already-loaded image. */
  initial?: { dataUrl: string; palette: ColorWeight[]; cuts: Cut[]; aspect: number } | null
}

interface Live {
  axis: Axis
  pos: number // normalized 0..1 on the axis
}

/**
 * Upload an image and bisect it with the cursor-entry-direction gesture. Entering the
 * image from top/bottom arms a vertical cut; from left/right, a horizontal cut. A live
 * cream hairline tracks the pointer; click drops it as a committed cut with a mono readout
 * and a draggable handle. Drag a cut off the image to delete it. A V/H pill pair is the
 * touch / no-entry fallback. "use these cuts →" hands the cuts + image palette upward.
 */
export function ImageBisection({ onCommit, initial = null }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(initial?.dataUrl ?? null)
  const [palette, setPalette] = useState<ColorWeight[]>(initial?.palette ?? [])
  const [cuts, setCuts] = useState<Cut[]>(initial?.cuts ?? [])
  const [aspect, setAspect] = useState<number>(initial?.aspect ?? 1) // image w/h, so it shows uncropped
  const [live, setLive] = useState<Live | null>(null)
  const [fallbackAxis, setFallbackAxis] = useState<Axis | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragErr, setDragErr] = useState<string | null>(null)

  const imgRef = useRef<HTMLDivElement>(null)
  const prevPt = useRef<Point | null>(null)
  const draggingCut = useRef<number | null>(null)
  const inside = useRef(false)

  const swatch = useMemo(() => dyadicLayout(palette), [palette])

  const ingest = useCallback(async (file: File) => {
    setBusy(true)
    setDragErr(null)
    try {
      const { pixels, width, height, dataUrl } = await loadImagePixels(file)
      const pal = kmeans(pixels, PALETTE_K, 1)
      setDataUrl(dataUrl)
      setPalette(pal)
      setAspect(height > 0 ? width / height : 1)
      setCuts([])
      setLive(null)
    } catch {
      setDragErr('could not read that image')
    } finally {
      setBusy(false)
    }
  }, [])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void ingest(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) void ingest(f)
  }

  // --- the cursor-entry-direction gesture, mapped to React pointer events ---

  // Coordinates are always relative to the *image* rect (origin = image top-left), even when
  // the pointer is in the surrounding gesture margin — that margin is what gives the
  // entry-direction detector an outside `prev` point to cross from.
  const imgPoint = (e: React.PointerEvent): Point | null => {
    const el = imgRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const imgSize = (): { w: number; h: number } => {
    const r = imgRef.current?.getBoundingClientRect()
    return { w: r?.width ?? 1, h: r?.height ?? 1 }
  }

  const isInside = (p: Point, size: { w: number; h: number }) =>
    p.x >= 0 && p.y >= 0 && p.x <= size.w && p.y <= size.h

  const onPointerMove = (e: React.PointerEvent) => {
    const curr = imgPoint(e)
    if (!curr) return
    const size = imgSize()
    const nowInside = isInside(curr, size)

    // dragging an existing cut takes precedence over the placement gesture
    const di = draggingCut.current
    if (di !== null) {
      setCuts((cs) => {
        const next = [...cs]
        const c = next[di]
        if (!c) return cs
        const pos = c.axis === 'v' ? curr.x / size.w : curr.y / size.h
        next[di] = { ...c, pos: Math.min(1, Math.max(0, pos)) }
        return next
      })
      prevPt.current = curr
      return
    }

    if (!nowInside) {
      // pointer is in the margin: clear the live guide, remember the outside point so the
      // next move *into* the image produces a real edge crossing.
      if (inside.current) setLive(null)
      inside.current = false
      prevPt.current = curr
      return
    }

    // pointer is inside the image. Determine the cut axis:
    const prev = prevPt.current
    let axis: Axis | null = null
    if (prev && !isInside(prev, size)) {
      // just crossed in from the margin → entry-direction decides the axis
      const edge = entryEdge(prev, curr, size)
      if (edge) axis = axisForEdge(edge)
    }
    // mid-stroke: keep the armed axis; else fall back to the V/H pill selection
    if (axis === null) axis = live?.axis ?? fallbackAxis

    if (axis) {
      const pos = axis === 'v' ? curr.x / size.w : curr.y / size.h
      setLive({ axis, pos: Math.min(1, Math.max(0, pos)) })
    }
    inside.current = true
    prevPt.current = curr
  }

  const onGestureLeave = () => {
    inside.current = false
    prevPt.current = null
    setLive(null)
  }

  const onClickPlace = (e: React.MouseEvent) => {
    if (draggingCut.current !== null) return
    // entry-direction path: a live guide is armed → drop it where it sits
    if (live) {
      setCuts((cs) => [...cs, { axis: live.axis, pos: Number(live.pos.toFixed(4)) }])
      return
    }
    // touch / no-entry fallback: a V/H pill is selected → drop a cut at the tap position
    if (fallbackAxis) {
      const el = imgRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / (r.width || 1)
      const y = (e.clientY - r.top) / (r.height || 1)
      if (x < 0 || y < 0 || x > 1 || y > 1) return
      const pos = fallbackAxis === 'v' ? x : y
      setCuts((cs) => [...cs, { axis: fallbackAxis, pos: Number(Math.min(1, Math.max(0, pos)).toFixed(4)) }])
    }
  }

  const startDragCut = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    draggingCut.current = i
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const endDragCut = (e: React.PointerEvent) => {
    const di = draggingCut.current
    if (di === null) return
    // drop off the image → delete the cut
    const curr = imgPoint(e)
    const size = imgSize()
    const off = !curr || !isInside(curr, size)
    if (off) setCuts((cs) => cs.filter((_, i) => i !== di))
    draggingCut.current = null
  }

  const removeCut = (i: number) => setCuts((cs) => cs.filter((_, idx) => idx !== i))

  const commit = () => dataUrl && onCommit(cuts, palette, dataUrl, aspect)

  if (!dataUrl) {
    return (
      <DropZone busy={busy} err={dragErr} onDrop={onDrop} onFile={onFile} />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* outer gesture area: the padding ring is the "outside" the entry detector crosses from */}
      <div
        onPointerMove={onPointerMove}
        onPointerLeave={onGestureLeave}
        onPointerUp={endDragCut}
        onClick={onClickPlace}
        style={{
          padding: 28,
          maxWidth: 560 + 56,
          width: '100%',
          boxSizing: 'border-box',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <div
          ref={imgRef}
          style={{
            position: 'relative',
            // box matches the image's aspect and fits within 560px wide / 64vh tall, so the whole
            // image shows uncropped and the normalized cuts land exactly where the user placed them
            width: `min(560px, ${(64 * aspect).toFixed(2)}vh)`,
            aspectRatio: String(aspect),
            margin: '0 auto',
            background: '#000',
            boxShadow: '0 24px 80px rgba(0,0,0,0.32)',
            cursor: live ? 'crosshair' : 'default',
            overflow: 'hidden',
          }}
        >
          <img
            src={dataUrl}
            alt="uploaded source"
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
          />

          {/* live guide tracking the pointer */}
          {live && <Guide axis={live.axis} pos={live.pos} ghost />}

          {/* committed cuts: cream hairline + handle + mono readout */}
          {cuts.map((c, i) => (
            <Guide
              key={i}
              axis={c.axis}
              pos={c.pos}
              onHandleDown={startDragCut(i)}
              onDelete={() => removeCut(i)}
            />
          ))}

          {/* live axis badge */}
          {live && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: CREAM,
                background: 'rgba(42,46,49,0.6)',
                padding: '3px 7px',
                pointerEvents: 'none',
              }}
            >
              {live.axis === 'v' ? 'VERTICAL' : 'HORIZONTAL'} · click to cut
            </div>
          )}
        </div>
      </div>

      {/* swatch read from the image palette */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <Label>image palette</Label>
        <svg width={120} height={120} viewBox="0 0 1 1" style={{ border: `1px solid ${HAIR}` }}>
          {swatch.map((s, i) => (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={rgbToHex(s.rgb)} />
          ))}
        </svg>
      </div>

      {/* touch / no-entry fallback: V / H pill toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <Label>cut axis (touch fallback)</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill label="V" on={fallbackAxis === 'v'} onClick={() => setFallbackAxis((a) => (a === 'v' ? null : 'v'))} />
          <Pill label="H" on={fallbackAxis === 'h'} onClick={() => setFallbackAxis((a) => (a === 'h' ? null : 'h'))} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Btn label="clear cuts" onClick={() => setCuts([])} />
        <Btn label="use these cuts →" onClick={commit} primary />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: CREAM, opacity: 0.55 }}>
        {cuts.length} cut{cuts.length === 1 ? '' : 's'} placed
      </div>
    </div>
  )
}

/** A cream hairline at a normalized position, optionally with a draggable handle + readout. */
function Guide({
  axis,
  pos,
  ghost,
  onHandleDown,
  onDelete,
}: {
  axis: Axis
  pos: number
  ghost?: boolean
  onHandleDown?: (e: React.PointerEvent) => void
  onDelete?: () => void
}) {
  const pct = `${pos * 100}%`
  const isV = axis === 'v'
  const cutName = `${isV ? 'V' : 'H'} ${pos.toFixed(2)}`
  const line: React.CSSProperties = isV
    ? { position: 'absolute', left: pct, top: 0, bottom: 0, width: 0, borderLeft: `1px ${ghost ? 'dashed' : 'solid'} ${CREAM}` }
    : { position: 'absolute', top: pct, left: 0, right: 0, height: 0, borderTop: `1px ${ghost ? 'dashed' : 'solid'} ${CREAM}` }
  return (
    <div style={{ ...line, opacity: ghost ? 0.7 : 1, pointerEvents: ghost ? 'none' : 'auto' }}>
      {!ghost && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label={`cut ${cutName}: drag to move, off the image to delete; Enter or Space to delete`}
            onPointerDown={onHandleDown}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onDelete?.()
              }
            }}
            title="drag to move · drag off image to delete"
            style={{
              position: 'absolute',
              ...(isV
                ? { left: -5, top: '50%', transform: 'translateY(-50%)' }
                : { top: -5, left: '50%', transform: 'translateX(-50%)' }),
              width: 11,
              height: 11,
              background: CREAM,
              border: `1px solid ${SLATE_INK}`,
              cursor: isV ? 'ew-resize' : 'ns-resize',
              touchAction: 'none',
            }}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label={`delete cut ${cutName}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onDelete?.()
              }
            }}
            style={{
              position: 'absolute',
              ...(isV
                ? { left: 6, top: 6 }
                : { top: 6, left: 6 }),
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '0.06em',
              color: SLATE_INK,
              background: CREAM,
              padding: '1px 5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cutName}
          </div>
        </>
      )}
    </div>
  )
}

function DropZone({
  busy,
  err,
  onDrop,
  onFile,
}: {
  busy: boolean
  err: string | null
  onDrop: (e: React.DragEvent) => void
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        onDrop(e)
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: 'min(560px, 80vw)',
        aspectRatio: '1 / 1',
        border: `1px dashed ${over ? CREAM : HAIR}`,
        background: over ? 'rgba(244,240,232,0.04)' : 'transparent',
        color: CREAM,
        cursor: 'pointer',
        transition: 'border-color 160ms, background 160ms',
        textAlign: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.02em' }}>
        {busy ? 'reading…' : 'drop an image'}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.55,
        }}
      >
        or click to choose · png · jpg · webp
      </div>
      {err && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e08c8c' }}>{err}</div>
      )}
    </label>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        opacity: 0.5,
        color: CREAM,
      }}
    >
      {children}
    </div>
  )
}

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{
        appearance: 'none',
        minWidth: 44,
        background: on ? CREAM : 'transparent',
        color: on ? SLATE_INK : CREAM,
        border: `1px solid ${on ? CREAM : HAIR}`,
        padding: '8px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        letterSpacing: '0.08em',
        cursor: 'pointer',
        transition: 'background 160ms, color 160ms',
      }}
    >
      {label}
    </button>
  )
}

function Btn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none',
        background: primary ? CREAM : 'transparent',
        color: primary ? SLATE_INK : CREAM,
        border: primary ? 'none' : `1px solid ${HAIR}`,
        padding: '11px 18px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.04em',
        cursor: 'pointer',
        ...(primary ? { boxShadow: `0 0 0 1px ${STEEL}` } : {}),
      }}
    >
      {label}
    </button>
  )
}
