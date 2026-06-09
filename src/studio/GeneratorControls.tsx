import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Grid, GeneratorKind } from '../grid/types'
import type { StudioMode } from './Studio'
import { GENERATOR_KINDS } from '../grid/generators'

const CREAM = '#f4f0e8'
const STEEL = '#4e6a7a'
const HAIR = 'rgba(244,240,232,0.22)'

interface Props {
  mode: StudioMode
  generator: GeneratorKind
  seed: number
  /** per-family structural params (driven by the shape sliders) */
  targetModules: number
  columns: number
  rows: number
  depth: number
  grid: Grid
  revealOn: boolean
  textOn: boolean
  canUndo: boolean
  canRedo: boolean
  /** image mode, cuts committed → showing the anchored composition. */
  imageCommitted: boolean
  /** image mode, at the upload/cut step. */
  bisecting: boolean
  onMode: (m: StudioMode) => void
  onGenerator: (k: GeneratorKind) => void
  onSeed: (s: number) => void
  onTargetModules: (v: number) => void
  onColumns: (v: number) => void
  onRows: (v: number) => void
  onDepth: (v: number) => void
  onGenerate: () => void
  onIterate: () => void
  onUndo: () => void
  onRedo: () => void
  onReBisect: () => void
  onToggleReveal: () => void
  onToggleText: () => void
  onExportPng: () => void
  onExportSvg: () => void
  busy?: boolean
}

const KIND_LABEL: Record<GeneratorKind, string> = {
  recursive: 'recursive',
  modular: 'modular',
  nature: 'nature',
}

export function GeneratorControls(p: Props) {
  return (
    <aside
      className="studio-rail"
      style={{
        boxSizing: 'border-box',
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        background: 'rgba(0,0,0,0.06)',
        borderRight: `1px solid ${HAIR}`,
        color: CREAM,
        overflowY: 'auto',
      }}
    >
      <header>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1, letterSpacing: '-0.03em' }}>
          Chickpea
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            opacity: 0.6,
            marginTop: 6,
          }}
        >
          generative grid studio
        </div>
      </header>

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
        <Section label="family">
          <Segmented
            options={GENERATOR_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            value={p.generator}
            onChange={(v) => p.onGenerator(v as GeneratorKind)}
          />
        </Section>
      )}

      {p.mode === 'scratch' && (
        <Section label="shape">
          {p.generator === 'recursive' && (
            <Slider label="cells" value={p.targetModules} min={2} max={24} onChange={p.onTargetModules} />
          )}
          {p.generator === 'modular' && (
            <>
              <Slider label="columns" value={p.columns} min={2} max={12} onChange={p.onColumns} />
              <Slider label="rows" value={p.rows} min={2} max={10} onChange={p.onRows} />
            </>
          )}
          {p.generator === 'nature' && (
            <Slider label="depth" value={p.depth} min={1} max={10} onChange={p.onDepth} />
          )}
        </Section>
      )}

      {p.imageCommitted && (
        <Section label="bisection">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              lineHeight: 1.5,
              opacity: 0.7,
              marginBottom: 10,
            }}
          >
            cuts are anchored to ratio positions; Generate re-seeds the math around them.
          </div>
          <ActionButton label="↶ re-bisect" hint="upload / re-cut" onClick={p.onReBisect} />
        </Section>
      )}

      {!p.bisecting && (
        <>
          <Section label="seed">
            <SeedField seed={p.seed} onSeed={p.onSeed} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <ActionButton label="Generate" hint="new seed" onClick={p.onGenerate} primary />
              <ActionButton label="Iterate" hint="seed + 1" onClick={p.onIterate} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <ActionButton label="↶ Undo" hint="⌘Z" onClick={p.onUndo} disabled={!p.canUndo} grow />
              <ActionButton label="↷ Redo" hint="⇧⌘Z" onClick={p.onRedo} disabled={!p.canRedo} grow />
            </div>
          </Section>

          <Section label="overlay">
            <Toggle label="Reveal math" on={p.revealOn} onClick={p.onToggleReveal} />
            <Toggle label="Type" on={p.textOn} onClick={p.onToggleText} />
          </Section>

          <Section label="readout">
            <Readout k="modules" v={String(p.grid.modules.length)} />
            <Readout k="guides" v={String(p.grid.guides.length)} />
            {p.grid.ratios.slice(0, 4).map((r, i) => (
              <Readout key={i} k={r.name} v={r.value.toFixed(3)} />
            ))}
          </Section>

          <Section label="export">
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionButton label="PNG" onClick={p.onExportPng} disabled={p.busy} grow />
              <ActionButton label="SVG" onClick={p.onExportSvg} disabled={p.busy} grow />
            </div>
          </Section>
        </>
      )}

      {p.bisecting && (
        <Section label="bisect">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              lineHeight: 1.55,
              opacity: 0.7,
            }}
          >
            upload an image, then enter it from an edge to arm a cut: top/bottom → vertical,
            left/right → horizontal. click to drop. commit the cuts to generate variations.
          </div>
        </Section>
      )}

      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 18 }}>
        <FooterLink to="/" label="← hero" />
        <FooterLink to="/case" label="case study" />
      </div>
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
          textTransform: 'uppercase',
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

/** A labeled range slider in the dark-rail vocabulary (mono caps, steel accent + value). Live —
 * drags update the composition continuously; the Studio coalesces a whole drag into one undo step. */
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
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
      <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.55, minWidth: '5.5em' }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: STEEL, cursor: 'pointer' }}
      />
      <span style={{ minWidth: '2.2em', textAlign: 'right', color: STEEL, letterSpacing: '0.04em' }}>{value}</span>
    </label>
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
    <div
      role="radiogroup"
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${HAIR}`,
      }}
    >
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
              cursor: 'pointer',
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

function SeedField({ seed, onSeed }: { seed: number; onSeed: (s: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Math.trunc(Number(draft))
    if (Number.isFinite(n)) onSeed(n)
    setDraft(null)
  }
  return (
    <input
      value={draft ?? String(seed)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      inputMode="numeric"
      aria-label="seed"
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
        appearance: 'none',
        background: primary ? CREAM : 'transparent',
        color: primary ? '#2a2e31' : CREAM,
        border: primary ? 'none' : `1px solid ${HAIR}`,
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.04em',
        cursor: disabled ? 'default' : 'pointer',
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
        cursor: 'pointer',
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

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: CREAM,
        opacity: 0.5,
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
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
