import { useEffect, useRef, useState } from 'react'
import type { Grid } from '../grid/types'
import type { PaletteColor } from '../palette/generate'

const CREAM = '#f4f0e8'
const HAIR = 'rgba(244,240,232,0.22)'
const CHIP = 'rgba(26,29,32,0.55)'

/** Short, honest name for how this composition was constructed (engineering flavor for the key). */
function strategyLabel(grid: Grid): string {
  if (grid.meta?.anchored) return 'anchored to your cuts'
  const s = (grid.meta?.genome as { strategy?: string } | undefined)?.strategy
  if (s === 'spiral') return 'spiral whirl'
  if (s === 'echo') return 'echo cascade'
  if (s === 'mirror') return 'mirrored'
  return grid.meta?.lattice ? 'stamped lattice' : 'organic growth'
}

/** The canvas aspect as a familiar name when it is one ("3:2"), else a decimal. */
function aspectLabel(aspect: number): string {
  const KNOWN: [number, string][] = [
    [1, '1:1'],
    [4 / 5, '4:5'],
    [5 / 4, '5:4'],
    [3 / 4, '3:4'],
    [4 / 3, '4:3'],
    [2 / 3, '2:3'],
    [3 / 2, '3:2'],
  ]
  for (const [v, name] of KNOWN) if (Math.abs(aspect - v) < 0.01) return name
  return `${aspect.toFixed(2)}:1`
}

/**
 * The key beside the composition: the palette's hex codes up top (each rendered in its own color,
 * selectable and click-to-copy), the math underneath — the ratios the cuts actually used, the
 * structure counts, the construction program, the canvas aspect, the seed. The same restrained
 * mono language as the rail, so it reads as part of the instrument, not a sticker on the art.
 */
export function CompositionKey({
  palette,
  grid,
  seed,
  maxHeight,
}: {
  palette: PaletteColor[]
  grid: Grid
  seed: number
  maxHeight: number
}) {
  return (
    <div
      style={{
        width: 172,
        maxHeight,
        boxSizing: 'border-box',
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '16px 16px 18px',
        background: 'rgba(0,0,0,0.1)',
        border: `1px solid ${HAIR}`,
        overflowY: 'auto',
        fontFamily: 'var(--font-mono)',
        color: CREAM,
      }}
    >
      <div>
        <KeyLabel>colors</KeyLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {palette.map((c, i) => (
            <HexRow key={i} hex={c.hex} />
          ))}
        </div>
      </div>

      <div>
        <KeyLabel>math</KeyLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grid.ratios.map((r, i) => (
            <KeyRow key={i} k={r.name} v={r.value.toFixed(3)} />
          ))}
          <div style={{ height: 6 }} />
          <KeyRow k="modules" v={String(grid.modules.length)} />
          <KeyRow k="guides" v={String(grid.guides.length)} />
          <KeyRow k="canvas" v={aspectLabel(grid.aspect || 1)} />
          <KeyRow k="build" v={strategyLabel(grid)} />
          <KeyRow k="seed" v={String(seed)} />
        </div>
      </div>
    </div>
  )
}

/** One palette entry: a swatch + the hex code rendered IN that color, selectable, click-to-copy. */
function HexRow({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = () => {
    void navigator.clipboard?.writeText(hex).then(() => {
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 900)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="click to copy"
      style={{
        appearance: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 7px',
        background: CHIP, // a dark chip so even pale hexes stay legible in their own color
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden
        style={{ width: 12, height: 12, flex: 'none', background: hex, border: `1px solid ${HAIR}` }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          letterSpacing: '0.04em',
          color: hex,
          userSelect: 'all',
        }}
      >
        {hex}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: CREAM, opacity: copied ? 0.9 : 0 }}>✓</span>
    </button>
  )
}

function KeyRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ opacity: 0.55, whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ textAlign: 'right', userSelect: 'text' }}>{v}</span>
    </div>
  )
}

function KeyLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        opacity: 0.5,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}
