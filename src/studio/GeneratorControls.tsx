import { useState } from 'react'
import type { Grid } from '../grid/types'
import type { StudioMode, InkMode } from './Studio'
import type { PaletteColor } from '../palette/generate'

const CREAM = '#f4f0e8'
const STEEL = '#4e6a7a'
const HAIR = 'rgba(244,240,232,0.22)'

interface Props {
  mode: StudioMode
  /** the three expressive dials (0..1): bias the engine's distribution; the seed re-rolls within it */
  complexity: number
  tension: number
  rhythm: number
  seed: string
  /** how many colors in the generated palette, and the live palette itself (for the swatch preview) */
  colorCount: number
  palette: PaletteColor[]
  grid: Grid
  revealOn: boolean
  /** false = skeleton only: hide the colored fills beneath the grid */
  colorsOn: boolean
  ink: InkMode
  annotate: boolean
  textOn: boolean
  canUndo: boolean
  canRedo: boolean
  imageCommitted: boolean
  bisecting: boolean
  onMode: (m: StudioMode) => void
  onComplexity: (v: number) => void
  onTension: (v: number) => void
  onRhythm: (v: number) => void
  onSeed: (s: string) => void
  onColorCount: (n: number) => void
  onGenerate: () => void
  onIterate: () => void
  onUndo: () => void
  onRedo: () => void
  onReBisect: () => void
  onToggleReveal: () => void
  onToggleColors: () => void
  onInk: (m: InkMode) => void
  onToggleAnnotate: () => void
  onToggleText: () => void
  onExportPng: () => void
  onExportSvg: () => void
  onExportReveal: () => void
  busy?: boolean
}

const pct = (v: number): string => `${Math.round(v * 100)}`

export function GeneratorControls(p: Props) {
  return (
    <aside
      className="studio-rail"
      style={{
        boxSizing: 'border-box',
        padding: '32px 28px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
        background: 'rgba(0,0,0,0.06)',
        borderRight: `1px solid ${HAIR}`,
        color: CREAM,
        overflowY: 'auto',
      }}
    >
      <Section label="source">
        <Segmented
          options={[
            { value: 'scratch', label: 'from scratch' },
            { value: 'image', label: 'from image' },
          ]}
          value={p.mode}
          onChange={(v) => p.onMode(v as StudioMode)}
        />
      </Section>

      {p.mode === 'scratch' && (
        <Section label="form">
          <Slider label="complexity" value={p.complexity} min={0} max={1} step={0.01} fmt={pct} onChange={p.onComplexity} />
          <Slider label="tension" value={p.tension} min={0} max={1} step={0.01} fmt={pct} onChange={p.onTension} />
          <Slider label="rhythm" value={p.rhythm} min={0} max={1} step={0.01} fmt={pct} onChange={p.onRhythm} />
        </Section>
      )}

      {!p.bisecting && (
        <Section label="color">
          {p.mode === 'scratch' && (
            <div style={{ marginBottom: 12 }}>
              <Slider label="colors" value={p.colorCount} min={2} max={12} onChange={p.onColorCount} />
            </div>
          )}
          <Swatches palette={p.palette} />
        </Section>
      )}

      {p.imageCommitted && (
        <Section label="bisection">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5, opacity: 0.7, marginBottom: 10 }}>
            cuts are anchored to ratio positions; generate re-seeds the math around them.
          </div>
          <ActionButton label="↶ re-bisect" hint="upload / re-cut" onClick={p.onReBisect} />
        </Section>
      )}

      {!p.bisecting && (
        <>
          <Section label="seed">
            <SeedField seed={p.seed} onSeed={p.onSeed} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <ActionButton label="generate" hint="new seed" onClick={p.onGenerate} primary />
              <ActionButton label="iterate" hint="seed + 1" onClick={p.onIterate} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <ActionButton label="↶ undo" hint="⌘Z" onClick={p.onUndo} disabled={!p.canUndo} grow />
              <ActionButton label="↷ redo" hint="⇧⌘Z" onClick={p.onRedo} disabled={!p.canRedo} grow />
            </div>
          </Section>

          <Section label="reveal math">
            <Toggle label="colors" on={p.colorsOn} onClick={p.onToggleColors} />
            <Toggle label="show overlay" on={p.revealOn} onClick={p.onToggleReveal} />
            <Toggle label="annotations" on={p.annotate} onClick={p.onToggleAnnotate} />
            <div style={{ marginTop: 10 }}>
              <Segmented
                options={[
                  { value: 'light', label: 'light ink' },
                  { value: 'dark', label: 'dark ink' },
                ]}
                value={p.ink}
                onChange={(v) => p.onInk(v as InkMode)}
              />
            </div>
            <Toggle label="type" on={p.textOn} onClick={p.onToggleText} />
          </Section>

          <Section label="readout">
            <Readout k="modules" v={String(p.grid.modules.length)} />
            <Readout k="guides" v={String(p.grid.guides.length)} />
            {p.grid.ratios.slice(0, 4).map((r, i) => (
              <Readout key={i} k={r.name} v={r.value.toFixed(3)} />
            ))}
          </Section>

          <Section label="export">
            <ActionButton label="reveal png (alpha)" hint="grid skeleton, transparent" onClick={p.onExportReveal} disabled={p.busy} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <ActionButton label="png" hint="composition" onClick={p.onExportPng} disabled={p.busy} grow />
              <ActionButton label="svg" hint="composition" onClick={p.onExportSvg} disabled={p.busy} grow />
            </div>
          </Section>
        </>
      )}

      {p.bisecting && (
        <Section label="bisect">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.55, opacity: 0.7 }}>
            upload an image, then enter it from an edge to arm a cut: top/bottom → vertical,
            left/right → horizontal. click to drop. commit the cuts to generate variations.
          </div>
        </Section>
      )}
    </aside>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          opacity: 0.5,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      {children}
    </section>
  )
}

/** A labeled range slider in the dark-rail vocabulary. Live: drags update continuously; the Studio
 * coalesces a whole drag into one undo step. `fmt` formats the readout (e.g. a 0..1 dial as a %). The
 * range input is left without an inline cursor so the global custom hand cursor applies. */
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  fmt,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  fmt?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '5px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        color: CREAM,
        userSelect: 'none',
      }}
    >
      <span style={{ letterSpacing: '0.1em', opacity: 0.55, minWidth: '5.5em' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: STEEL }}
      />
      <span style={{ minWidth: '2.2em', textAlign: 'right', color: STEEL, letterSpacing: '0.04em' }}>
        {fmt ? fmt(value) : value}
      </span>
    </label>
  )
}

/** Live readout of the generated palette: the hero (index 0) gets a wider cell so it reads dominant. */
function Swatches({ palette }: { palette: PaletteColor[] }) {
  if (palette.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 3, height: 32 }}>
      {palette.map((c, i) => (
        <div key={i} title={c.hex} style={{ flex: i === 0 ? 1.7 : 1, background: c.hex, borderRadius: 2 }} />
      ))}
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${HAIR}` }}>
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            style={{
              appearance: 'none',
              background: active ? CREAM : 'transparent',
              color: active ? '#2a2e31' : CREAM,
              border: 'none',
              borderTop: i === 0 ? 'none' : `1px solid ${HAIR}`,
              textAlign: 'left',
              padding: '11px 14px',
              font: 'inherit',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: '0.02em',
              transition: 'background 160ms, color 160ms',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SeedField({ seed, onSeed }: { seed: string; onSeed: (s: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    // any non-empty string is a valid seed (number, word, phrase, symbols — hashed at the engine)
    const s = draft.trim()
    if (s.length > 0) onSeed(s)
    setDraft(null)
  }
  return (
    <input
      value={draft ?? seed}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      aria-label="seed (any text)"
      placeholder="number, word, or phrase"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        background: 'transparent',
        border: `1px solid ${HAIR}`,
        color: CREAM,
        fontFamily: 'var(--font-mono)',
        fontSize: 15,
        letterSpacing: '0.04em',
        padding: '10px 12px',
        outline: 'none',
      }}
    />
  )
}

function ActionButton({
  label,
  hint,
  onClick,
  primary,
  disabled,
  grow,
}: {
  label: string
  hint?: string
  onClick: () => void
  primary?: boolean
  disabled?: boolean
  grow?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      style={{
        flex: grow ? 1 : undefined,
        width: grow ? undefined : '100%',
        appearance: 'none',
        background: primary ? CREAM : 'transparent',
        color: primary ? '#2a2e31' : CREAM,
        border: primary ? 'none' : `1px solid ${HAIR}`,
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.04em',
        // disabled keeps the arrow; otherwise the global custom hand cursor applies (no inline override)
        cursor: disabled ? 'default' : undefined,
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 160ms, background 160ms',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{
        appearance: 'none',
        background: 'transparent',
        border: 'none',
        color: CREAM,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '7px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ opacity: on ? 1 : 0.72 }}>{label}</span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 34,
          height: 16,
          border: `1px solid ${HAIR}`,
          background: on ? STEEL : 'transparent',
          transition: 'background 160ms',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: on ? 19 : 1,
            width: 12,
            height: 12,
            background: CREAM,
            transition: 'left 160ms cubic-bezier(.22,1,.36,1)',
          }}
        />
      </span>
    </button>
  )
}

function Readout({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        padding: '4px 0',
        borderBottom: `1px solid ${HAIR}`,
      }}
    >
      <span style={{ opacity: 0.55 }}>{k}</span>
      <span style={{ letterSpacing: '0.03em' }}>{v}</span>
    </div>
  )
}
