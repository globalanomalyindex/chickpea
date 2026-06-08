import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { GeneratorKind } from '../grid/types'
import { generate } from '../grid/generators'
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
import { compositionToPngBlob } from '../io/export-png'
import { exportFilename } from '../io/filename'
import { downloadBlob, downloadText } from '../io/download'
import { CornerNav } from '../app/CornerNav'

const SLATE = '#5d646b'
const PALETTE_COUNT = 6
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

export function Studio() {
  const [params, setParams] = useSearchParams()
  // read the descriptor from the URL exactly once on mount (shareable reproduction)
  const initial = useRef(decodeDescriptor(params)).current

  const [mode, setMode] = useState<StudioMode>('scratch')
  const [image, setImage] = useState<ImageState | null>(null)

  const [generator, setGenerator] = useState<GeneratorKind>(initial.kind)
  const [seed, setSeed] = useState<number>(initial.seed)
  const [revealOn, setRevealOn] = useState(false)
  const [textOn, setTextOn] = useState(true)
  const [busy, setBusy] = useState(false)

  // are we sitting in the bisection step (image mode, nothing committed yet)?
  const bisecting = mode === 'image' && image === null

  // keep (generator, seed) in the URL query so any state is shareable
  useEffect(() => {
    const next = new URLSearchParams(params)
    encodeDescriptor({ kind: generator, seed }, next)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generator, seed])

  // In image mode the grid is the anchored grid (cuts fixed, math seed-varied); in scratch
  // mode it is the chosen generator. Either way Generate/Iterate re-seed the variations.
  const grid = useMemo(() => {
    if (mode === 'image' && image) return buildAnchoredGrid(image.cuts, seed)
    return generate(generator, seed)
  }, [mode, image, generator, seed])

  const palette = useMemo(() => {
    if (mode === 'image' && image && image.palette.length > 0) return imagePaletteToPalette(image.palette)
    return generatePalette(seed, PALETTE_COUNT)
  }, [mode, image, seed])

  const composition = useMemo(
    () => buildComposition(grid, palette, { seed, textChance: textOn ? 0.3 : 0 }),
    [grid, palette, seed, textOn],
  )

  const onGenerate = useCallback(() => setSeed(randomSeed()), [])
  const onIterate = useCallback(() => setSeed((s) => s + 1), [])

  const onMode = useCallback((m: StudioMode) => {
    setMode(m)
    if (m === 'scratch') setImage(null)
  }, [])

  const onCommitImage = useCallback((cuts: Cut[], pal: ColorWeight[], dataUrl: string) => {
    setImage({ cuts, palette: pal, dataUrl })
    setSeed(randomSeed()) // first seeded variation of the committed cuts
  }, [])

  const onReBisect = useCallback(() => setImage(null), [])

  const exportPng = useCallback(async () => {
    setBusy(true)
    try {
      await loadMafinestDataUrl().catch(() => null) // warm the font for canvas measure
      const blob = await compositionToPngBlob(composition, grid, { width: EXPORT_PX, height: EXPORT_PX, scale: 2 })
      downloadBlob(blob, exportFilename('png'))
    } finally {
      setBusy(false)
    }
  }, [composition, grid])

  const exportSvg = useCallback(async () => {
    setBusy(true)
    try {
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
      style={{
        position: 'fixed',
        inset: 0,
        background: SLATE,
        display: 'flex',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <CornerNav />
      <GeneratorControls
        mode={mode}
        generator={generator}
        seed={seed}
        grid={grid}
        revealOn={revealOn}
        textOn={textOn}
        busy={busy}
        imageCommitted={mode === 'image' && image !== null}
        bisecting={bisecting}
        onMode={onMode}
        onGenerator={setGenerator}
        onSeed={setSeed}
        onGenerate={onGenerate}
        onIterate={onIterate}
        onReBisect={onReBisect}
        onToggleReveal={() => setRevealOn((v) => !v)}
        onToggleText={() => setTextOn((v) => !v)}
        onExportPng={exportPng}
        onExportSvg={exportSvg}
      />

      <Stage>
        {(size) =>
          bisecting ? (
            <ImageBisection onCommit={onCommitImage} />
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
