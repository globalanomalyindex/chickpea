import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { generateGrid } from '../grid/engine'
import { buildAnchoredGrid, type Cut } from '../grid/anchor'
import { encodeDescriptor, decodeDescriptor } from '../grid/serialize'
import { generatePalette } from '../palette/generate'
import type { ColorWeight } from '../palette/kmeans'
import { buildComposition } from './composition'
import { imagePaletteToPalette } from './imagePalette'
import { CompositionSvg } from './CompositionSvg'
import { SkeletonReveal } from './SkeletonReveal'
import { GeneratorControls } from './GeneratorControls'
import { ImageBisection } from './ImageBisection'
import { compositionToSvg, loadMafinestDataUrl } from '../io/export-svg'
import { compositionToPngBlob, ensureExportFontReady } from '../io/export-png'
import { gridSkeletonToPngBlob, LIGHT_INK, DARK_INK } from '../io/export-skeleton-png'
import { exportFilename } from '../io/filename'
import { downloadBlob, downloadText } from '../io/download'
import { CornerNav } from '../app/CornerNav'
import './studio.css'

const SLATE = '#5d646b'
const EXPORT_PX = 1600

export type StudioMode = 'scratch' | 'image'
export type InkMode = 'light' | 'dark'
interface ImageState {
  cuts: Cut[]
  palette: ColorWeight[]
  dataUrl: string
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000)
}

/** The full generative state — one object so history (undo/redo) is a stack of snapshots. The three
 * dials drive the procedural engine's distribution; the seed re-rolls variations within them. */
export interface Doc {
  complexity: number // 0..1 — sparse → intricate
  tension: number // 0..1 — calm/centered → dynamic/focal
  rhythm: number // 0..1 — organic/free → periodic/lattice
  seed: number
  colorCount: number // how many colors in the generated palette
}

function defaultDoc(complexity: number, tension: number, rhythm: number, seed: number, colorCount: number): Doc {
  return { complexity, tension, rhythm, seed, colorCount }
}

interface History {
  doc: Doc
  past: Doc[]
  future: Doc[]
}

export function Studio() {
  const [params, setParams] = useSearchParams()
  // read the descriptor from the URL exactly once on mount (shareable reproduction)
  const initial = useRef(decodeDescriptor(params)).current

  const [mode, setMode] = useState<StudioMode>('scratch')
  const [image, setImage] = useState<ImageState | null>(null)
  // true while the user is back in the bisection step adjusting an already-committed image.
  const [reBisecting, setReBisecting] = useState(false)

  // generative state + undo/redo history (a single snapshot stack)
  const [hist, setHist] = useState<History>(() => ({
    doc: defaultDoc(initial.complexity, initial.tension, initial.rhythm, initial.seed, initial.count),
    past: [],
    future: [],
  }))
  const doc = hist.doc
  const { complexity, tension, rhythm, seed, colorCount } = doc
  // coalesce rapid same-field edits (slider drags, repeated taps) into ONE undo step
  const coalesceKey = useRef<string | null>(null)
  const coalesceAt = useRef(0)

  // The coalesce decision happens HERE (before setHist) so the setHist updater stays pure — React
  // StrictMode double-invokes updaters, which would otherwise run the ref side-effects twice.
  const commit = useCallback((p: Partial<Doc> | ((d: Doc) => Partial<Doc>), key?: keyof Doc) => {
    const now = performance.now()
    const sameField = key != null && coalesceKey.current === key && now - coalesceAt.current < 600
    coalesceKey.current = key ?? null
    coalesceAt.current = now
    setHist((s) => {
      const partial = typeof p === 'function' ? p(s.doc) : p
      const next = { ...s.doc, ...partial }
      const past = sameField ? s.past : [...s.past, s.doc].slice(-120)
      return { doc: next, past, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    coalesceKey.current = null
    setHist((s) => (s.past.length ? { doc: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.doc, ...s.future] } : s))
  }, [])
  const redo = useCallback(() => {
    coalesceKey.current = null
    setHist((s) => (s.future.length ? { doc: s.future[0], past: [...s.past, s.doc], future: s.future.slice(1) } : s))
  }, [])
  const canUndo = hist.past.length > 0
  const canRedo = hist.future.length > 0

  const [revealOn, setRevealOn] = useState(false)
  const [ink, setInk] = useState<InkMode>('light')
  const [annotate, setAnnotate] = useState(true)
  const [textOn, setTextOn] = useState(true)
  const [busy, setBusy] = useState(false)
  const inkHex = ink === 'dark' ? DARK_INK : LIGHT_INK

  // are we sitting in the bisection step?
  const bisecting = mode === 'image' && (image === null || reBisecting)

  // keep (dials, seed, count) in the URL query so any state is shareable
  useEffect(() => {
    const next = new URLSearchParams(params)
    encodeDescriptor({ complexity, tension, rhythm, seed, count: colorCount }, next)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complexity, tension, rhythm, seed, colorCount])

  // In image mode the grid is the anchored grid (cuts fixed, math seed-varied); in scratch mode it is
  // the procedural engine driven by (seed, dials). Either way Generate/Iterate re-seed the variations.
  const grid = useMemo(() => {
    if (mode === 'image' && image) return buildAnchoredGrid(image.cuts, seed)
    return generateGrid(seed, { complexity, tension, rhythm })
  }, [mode, image, seed, complexity, tension, rhythm])

  const palette = useMemo(() => {
    if (mode === 'image' && image && image.palette.length > 0) return imagePaletteToPalette(image.palette)
    return generatePalette(seed, colorCount)
  }, [mode, image, seed, colorCount])

  const composition = useMemo(
    () => buildComposition(grid, palette, { seed, textChance: textOn ? 0.3 : 0 }),
    [grid, palette, seed, textOn],
  )

  const onGenerate = useCallback(() => commit({ seed: randomSeed() }, 'seed'), [commit])
  const onIterate = useCallback(() => commit((d) => ({ seed: d.seed + 1 }), 'seed'), [commit])

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo. Skip while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      } else if (k === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const onMode = useCallback((m: StudioMode) => {
    setMode(m)
    if (m === 'scratch') {
      setImage(null)
      setReBisecting(false)
    }
  }, [])

  const onCommitImage = useCallback(
    (cuts: Cut[], pal: ColorWeight[], dataUrl: string) => {
      setImage({ cuts, palette: pal, dataUrl })
      setReBisecting(false)
      commit({ seed: randomSeed() })
    },
    [commit],
  )

  const onReBisect = useCallback(() => setReBisecting(true), [])

  const exportPng = useCallback(async () => {
    setBusy(true)
    try {
      await ensureExportFontReady()
      const blob = await compositionToPngBlob(composition, grid, { width: EXPORT_PX, height: EXPORT_PX, scale: 2 })
      downloadBlob(blob, exportFilename('png'))
    } finally {
      setBusy(false)
    }
  }, [composition, grid])

  const exportSvg = useCallback(async () => {
    setBusy(true)
    try {
      await ensureExportFontReady()
      const fontDataUrl = await loadMafinestDataUrl().catch(() => undefined)
      const svg = compositionToSvg(composition, grid, {
        width: EXPORT_PX,
        height: EXPORT_PX,
        includeGrid: revealOn,
        fontDataUrl: fontDataUrl ?? undefined,
      })
      downloadText(svg, exportFilename('svg'))
    } finally {
      setBusy(false)
    }
  }, [composition, grid, revealOn])

  // "Reveal math" export: the grid skeleton as a TRUE PNG with alpha (transparent), lines always,
  // annotations optional, in the current ink. The headline new feature.
  const exportRevealPng = useCallback(async () => {
    setBusy(true)
    try {
      const blob = await gridSkeletonToPngBlob(grid, { width: EXPORT_PX, height: EXPORT_PX, ink: inkHex, annotate, scale: 2 })
      downloadBlob(blob, exportFilename('png'))
    } finally {
      setBusy(false)
    }
  }, [grid, inkHex, annotate])

  return (
    <main
      className="studio-shell"
      style={{ position: 'fixed', inset: 0, background: SLATE, fontFamily: 'var(--font-mono)' }}
    >
      <CornerNav />
      <GeneratorControls
        mode={mode}
        complexity={complexity}
        tension={tension}
        rhythm={rhythm}
        seed={seed}
        colorCount={colorCount}
        palette={palette}
        grid={grid}
        revealOn={revealOn}
        ink={ink}
        annotate={annotate}
        textOn={textOn}
        busy={busy}
        canUndo={canUndo}
        canRedo={canRedo}
        imageCommitted={mode === 'image' && image !== null && !bisecting}
        bisecting={bisecting}
        onMode={onMode}
        onComplexity={(v) => commit({ complexity: v }, 'complexity')}
        onTension={(v) => commit({ tension: v }, 'tension')}
        onRhythm={(v) => commit({ rhythm: v }, 'rhythm')}
        onSeed={(s) => commit({ seed: s }, 'seed')}
        onColorCount={(n) => commit({ colorCount: n }, 'colorCount')}
        onGenerate={onGenerate}
        onIterate={onIterate}
        onUndo={undo}
        onRedo={redo}
        onReBisect={onReBisect}
        onToggleReveal={() => setRevealOn((v) => !v)}
        onInk={setInk}
        onToggleAnnotate={() => setAnnotate((v) => !v)}
        onToggleText={() => setTextOn((v) => !v)}
        onExportPng={exportPng}
        onExportSvg={exportSvg}
        onExportReveal={exportRevealPng}
      />

      <Stage>
        {(size) =>
          bisecting ? (
            <ImageBisection
              onCommit={onCommitImage}
              initial={
                reBisecting && image
                  ? { dataUrl: image.dataUrl, palette: image.palette, cuts: image.cuts }
                  : null
              }
            />
          ) : (
            <div style={{ position: 'relative', width: size, height: size }}>
              <div style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.32)' }}>
                <CompositionSvg composition={composition} grid={grid} size={size} aspect={1} />
              </div>
              <SkeletonReveal grid={grid} size={size} aspect={1} show={revealOn} ink={inkHex} />
            </div>
          )
        }
      </Stage>
    </main>
  )
}

/** Centers the composition in the remaining field and sizes it to fit with margin. */
function Stage({ children }: { children: (size: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const margin = 88
      setSize(Math.max(160, Math.min(r.width - margin, r.height - margin)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="studio-stage"
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
        overflowY: 'auto',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {size > 0 && children(size)}
    </div>
  )
}
