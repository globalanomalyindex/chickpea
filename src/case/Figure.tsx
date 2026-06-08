import type { ReactNode } from 'react'

const CREAM = '#f4f0e8'
const STEEL = '#4e6a7a'
const SLATE = '#5d646b'
const HAIR = 'rgba(93,100,107,0.22)'

interface FigureProps {
  /** the figure number, e.g. "01". */
  index: string
  /** short title, e.g. "Recursive subdivision". */
  title: string
  /** the interactive bit. */
  children: ReactNode
  /** what the reader should notice. */
  caption: string
}

/**
 * The frame around a live case-study figure: a mono number + label, the interactive
 * figure, and a caption — in the cream/mono design language, with generous space.
 * Figures sit on cream so the slate grid lines read; they are the bright counter-rhythm
 * to the slate prose sections.
 */
export function Figure({ index, title, children, caption }: FigureProps) {
  return (
    <figure
      style={{
        margin: 0,
        background: CREAM,
        color: SLATE,
        border: `1px solid ${HAIR}`,
        padding: 'clamp(20px, 4vw, 40px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <figcaption
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: '0.18em', color: STEEL }}>
          FIG&nbsp;{index}
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: SLATE,
            opacity: 0.65,
          }}
        >
          {title}
        </span>
      </figcaption>

      {children}

      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          lineHeight: 1.6,
          color: SLATE,
          opacity: 0.72,
          maxWidth: '62ch',
        }}
      >
        {caption}
      </p>
    </figure>
  )
}

/** A labeled slider with a live mono readout, matching the studio's control aesthetic. */
export function FigureSlider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** how to render the value (defaults to the raw number). */
  display?: string
  onChange: (v: number) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        color: SLATE,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity: 0.6,
          minWidth: '7.5em',
        }}
      >
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
      <span style={{ minWidth: '3.5em', textAlign: 'right', letterSpacing: '0.04em', color: STEEL }}>
        {display ?? value}
      </span>
    </label>
  )
}

/** A row of small mono readouts (key: value), for figure provenance. */
export function FigureReadouts({ items }: { items: { k: string; v: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
      {items.map((it) => (
        <span
          key={it.k}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: SLATE }}
        >
          <span style={{ opacity: 0.5 }}>{it.k}&nbsp;</span>
          <span style={{ color: STEEL, letterSpacing: '0.03em' }}>{it.v}</span>
        </span>
      ))}
    </div>
  )
}
