import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { GeneratorKind } from '../grid/types'
import { generateRecursive, defaultRecursiveParams } from '../grid/generators/recursive'
import { generateModular } from '../grid/generators/modular'
import { generateNature, defaultNatureParams } from '../grid/generators/nature'
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
import { exportFilename } from '../io/filename'
import { downloadBlob, downloadText } from '../io/download'
import { CornerNav } from '../app/CornerNav'
import './studio.css'

const SLATE = '#5d646b'
const EXPORT_PX = 1600

export type StudioMode = 'scratch' | 'image'
interface ImageState {
  cuts: Cut[]
  palette: ColorWeight[]
  dataUrl: string
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000)
}

/** Swiss modular margin/gutter (fractions of the square) — matches the case-study figure. */
const MODULAR_MARGIN = 0.06
const MODULAR_GUTTER = 0.022

/** The full generative state — one object so history (undo/redo) is a stack of snapshots. The
 * sliders below drive the per-family structural params; the seed re-rolls variations within them. */
export interface Doc {
  generator: GeneratorKind
  seed: number
  targetModules: number // recursive
  columns: number // modular
  rows: number // modular
  depth: number // nature
  colorCount: number // how many colors in the generated palette
}

function defaultDoc(generator: GeneratorKind, seed: number, colorCount: number): Doc {
  return { generator, seed, targetModules: 9, columns: 6, rows: 4, depth: 6, colorCount }
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
  // we keep `image` populated so its dataUrl/palette/cuts survive and seed the ImageBisection.
  const [reBisecting, setReBisecting] = useState(false)

  // generative state + undo/redo history (a single snapshot stack)
  const [hist, setHist] = useState<History>(() => ({
    doc: defaultDoc(initial.kind, initial.seed, initial.count),
    past: [],
    future: [],
  }))
  const doc = hist.doc
  const { generator, seed, targetModules, columns, rows, depth, colorCount } = doc
  // coalesce rapid same-field edits (slider drags, repeated taps) into ONE undo step
  const coalesceKey = useRef<string | null>(null)
  const coalesceAt = useRef(0)

  // `key` names the field being edited so a run of same-field edits (a slider drag, repeated taps)
  // collapses to ONE undo step. The coalesce decision happens HERE (before setHist) so the setHist
  // updater stays pure — React StrictMode double-invokes updaters, which would otherwise run the
  // ref side-effects twice and silently drop the history push.
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
  const [textOn, setTextOn] = useState(true)
  const [busy, setBusy] = useState(false)

  // are we sitting in the bisection step? image mode, with either nothing committed yet or
  // the user explicitly back in to re-bisect an already-committed image.
  const bisecting = mode === 'image' && (image === null || reBisecting)

  // keep (generator, seed) in the URL query so any state is shareable
  useEffect(() => {
    const next = new URLSearchParams(params)
    encodeDescriptor({ kind: generator, seed, count: colorCount }, next)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generator, seed, colorCount])

  // In image mode the grid is the anchored grid (cuts fixed, math seed-varied); in scratch
  // mode it is the chosen generator. Either way Generate/Iterate re-seed the variations.
  const grid = useMemo(() => {
    if (mode === 'image' && image) return buildAnchoredGrid(image.cuts, seed)
    if (generator === 'recursive') return generateRecursive(seed, { ...defaultRecursiveParams, targetModules })
    if (generator === 'modular')
      return generateModular(seed, { kind: 'modular', columns, rows, margin: MODULAR_MARGIN, gutter: MODULAR_GUTTER })
    return generateNature(seed, { ...defaultNatureParams, depth })
  }, [mode, image, generator, seed, targetModules, columns, rows, depth])

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

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo. Skip while typing in a field (let the
  // browser do native text undo there).
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
      setReBisecting(false) // leaving the bisection step → show the anchored composition
      commit({ seed: randomSeed() }) // first seeded variation of the committed cuts
    },
    [commit],
  )

  // return to the bisection step, keeping the committed image/cuts so they seed ImageBisection
  const onReBisect = useCallback(() => setReBisecting(true), [])

  const exportPng = useCallback(async () => {
    setBusy(true)
    try {
      await ensureExportFontReady() // load Mafinest so canvas measure/draw doesn't fall back to Georgia
      const blob = await compositionToPngBlob(composition, grid, { width: EXPORT_PX, height: EXPORT_PX, scale: 2 })
      downloadBlob(blob, exportFilename('png'))
    } finally {
      setBusy(false)
    }
  }, [composition, grid])

  const exportSvg = useCallback(async () => {
    setBusy(true)
    try {
      await ensureExportFontReady() // load Mafinest so the synchronous measure (measureLine) doesn't fall back to Georgia
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

  return (
    <main
      className="studio-shell"
      style={{
        position: 'fixed',
        inset: 0,
        background: SLATE,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <CornerNav />
      <GeneratorControls
        mode={mode}
        generator={generator}
        seed={seed}
        targetModules={targetModules}
        columns={columns}
        rows={rows}
        depth={depth}
        colorCount={colorCount}
        palette={palette}
        grid={grid}
        revealOn={revealOn}
        textOn={textOn}
        busy={busy}
        canUndo={canUndo}
        canRedo={canRedo}
        imageCommitted={mode === 'image' && image !== null && !bisecting}
        bisecting={bisecting}
        onMode={onMode}
        onGenerator={(k) => commit({ generator: k }, 'generator')}
        onSeed={(s) => commit({ seed: s }, 'seed')}
        onTargetModules={(v) => commit({ targetModules: v }, 'targetModules')}
        onColumns={(v) => commit({ columns: v }, 'columns')}
        onRows={(v) => commit({ rows: v }, 'rows')}
        onDepth={(v) => commit({ depth: v }, 'depth')}
        onColorCount={(n) => commit({ colorCount: n }, 'colorCount')}
        onGenerate={onGenerate}
        onIterate={onIterate}
        onUndo={undo}
        onRedo={redo}
        onReBisect={onReBisect}
        onToggleReveal={() => setRevealOn((v) => !v)}
        onToggleText={() => setTextOn((v) => !v)}
        onExportPng={exportPng}
        onExportSvg={exportSvg}
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
              <SkeletonReveal grid={grid} size={size} aspect={1} show={revealOn} />
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
