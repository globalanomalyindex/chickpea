/**
 * "The work, shown" — the engineering evidence section at the foot of the case study. Every number
 * here is REAL: collected from the measurement harnesses (scripts/sample-grids.ts and
 * sample-palettes.ts, 500 seeds each) and the vitest suite, not invented for the page. Rendered as
 * plain inline bars in the cream/mono language so the data reads as instrumentation, not decoration.
 */

const CREAM = '#f4f0e8'
const STEEL = '#a6bac6'
const HAIR = 'rgba(244,240,232,0.16)'

interface Bar {
  label: string
  /** 0..1 fill fraction */
  value: number
  /** the printed readout (e.g. "36%", "0.71") */
  read: string
  /** optional accent color for this bar's fill */
  tone?: string
}

export function WorkShown() {
  return (
    <section
      aria-labelledby="data-h"
      style={{ margin: 'clamp(48px, 10vw, 104px) 0 0' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          color: STEEL,
          marginBottom: 16,
        }}
      >
        the work, shown
      </div>
      <h2
        id="data-h"
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(26px, 4.6vw, 40px)',
          lineHeight: 1.12,
          letterSpacing: '-0.01em',
          maxWidth: '20ch',
        }}
      >
        measured, not claimed.
      </h2>
      <p
        style={{
          margin: '20px 0 0',
          maxWidth: '64ch',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(16px, 2.1vw, 18px)',
          lineHeight: 1.62,
          color: CREAM,
          opacity: 0.86,
        }}
      >
        the hard calls were settled by running the engines five hundred seeds at a time and reading
        the distribution. these are those readings, current as of the build you are looking at.
      </p>

      <div
        style={{
          marginTop: 'clamp(28px, 5vw, 44px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'clamp(20px, 4vw, 36px)',
        }}
      >
        <Stat
          big="100%"
          caption="of 500 seeds × 27 dial settings render a perfect tiling: zero gaps, zero overlaps, every guide bit-exact on a module edge. correctness is structural, and 235 unit and invariant tests hold the line."
        />

        <Panel
          title="grid build programs"
          note="a composition is an ordered chain of 1–4 stages; most stay short, the long body plans are rare. 500 seeds, default dials."
          bars={[
            { label: '1 stage', value: 278 / 278, read: '56%' },
            { label: '2 stages', value: 148 / 278, read: '30%' },
            { label: '3 stages', value: 57 / 278, read: '11%' },
            { label: '4 stages', value: 17 / 278, read: '3%' },
          ]}
        />

        <Panel
          title="coordinated stages emerge"
          note="the cut programs randomness can't reach, kept a deliberate minority so no one genre collapses the output."
          bars={[
            { label: 'lattice', value: 0.258 / 0.26, read: '26%' },
            { label: 'spiral', value: 0.16 / 0.26, read: '16%' },
            { label: 'echo', value: 0.096 / 0.26, read: '10%' },
            { label: 'mirror', value: 0.072 / 0.26, read: '7%' },
          ]}
        />

        <Panel
          title="hero color, freed"
          note="share of palettes whose lead color is magenta/violet. judging vividness on absolute chroma funneled there; judging it relative to each hue's own gamut ceiling fixed it."
          bars={[
            { label: 'absolute chroma', value: 0.86, read: '86%', tone: '#b056c8' },
            { label: 'relative (now)', value: 0.36, read: '36%', tone: '#b056c8' },
          ]}
        />

        <Panel
          title="palette genres reachable"
          note="share of 500 seeds landing in each look. none is hard-coded; each emerges from the continuous axes and survives selection."
          bars={[
            { label: '60-30-10 family', value: 45 / 45, read: '45%' },
            { label: 'spread hue', value: 36 / 45, read: '36%' },
            { label: 'tight / mono', value: 22 / 45, read: '22%' },
            { label: 'neon / jewel', value: 12 / 45, read: '12%' },
            { label: 'sunset ramp', value: 8 / 45, read: '8%' },
            { label: 'high-key pastel', value: 6 / 45, read: '6%' },
            { label: 'low-key moody', value: 5 / 45, read: '5%' },
            { label: 'figure-ground', value: 2 / 45, read: '2%' },
          ]}
        />

        <Panel
          title="quality floor + variety"
          note="the worst seed, not the average, is the real test. the palette floor jumped once candidates were scored exactly as they ship; variety holds (the most common grid is under a tenth of output)."
          bars={[
            { label: 'palette, worst of 500', value: 0.71, read: '0.71' },
            { label: 'palette, was', value: 0.18, read: '0.18', tone: 'rgba(244,240,232,0.3)' },
            { label: 'grid, worst of 500', value: 0.67, read: '0.67' },
            { label: 'top grid attractor', value: 0.094, read: '9%' },
          ]}
        />
      </div>
    </section>
  )
}

function Stat({ big, caption }: { big: string; caption: string }) {
  return (
    <div style={{ border: `1px solid ${HAIR}`, padding: '20px 20px 22px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 9vw, 72px)', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {big}
      </div>
      <p style={{ margin: '14px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.55, color: CREAM, opacity: 0.7 }}>
        {caption}
      </p>
    </div>
  )
}

function Panel({ title, note, bars }: { title: string; note: string; bars: Bar[] }) {
  return (
    <div style={{ border: `1px solid ${HAIR}`, padding: '18px 20px 22px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: STEEL, marginBottom: 14 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: '0 0 116px', fontFamily: 'var(--font-mono)', fontSize: 11, color: CREAM, opacity: 0.72, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {b.label}
            </span>
            <span style={{ flex: 1, height: 6, background: 'rgba(244,240,232,0.08)', position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: `${Math.max(0, Math.min(1, b.value)) * 100}%`,
                  background: b.tone ?? STEEL,
                }}
              />
            </span>
            <span style={{ flex: '0 0 34px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: CREAM }}>
              {b.read}
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: '14px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.5, color: CREAM, opacity: 0.5 }}>
        {note}
      </p>
    </div>
  )
}
