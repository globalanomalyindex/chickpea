import { Link } from 'react-router-dom'
import { BrandMenu } from '../app/BrandMenu'
import { RainbowText, NatureWord } from '../components/colorWords'
import { SECTIONS, TITLE, type Section } from './content'
import { SubdivisionFigure } from './figures/SubdivisionFigure'
import { GoldenFigure } from './figures/GoldenFigure'
import { ModularFigure } from './figures/ModularFigure'
import { MeasureFigure } from './figures/MeasureFigure'

const SLATE = '#5d646b'
const CREAM = '#f4f0e8'
/** the steel accent lifted for legibility as an eyebrow on the slate field. */
const STEEL_ON_SLATE = '#a6bac6'
const HAIR_CREAM = 'rgba(244,240,232,0.18)'

/** Figures that render immediately after a given section's prose. */
const FIGURES_AFTER: Record<string, React.FC[]> = {
  grid: [SubdivisionFigure, GoldenFigure, ModularFigure],
  craft: [MeasureFigure],
}

export function CaseStudy() {
  return (
    <main
      style={{
        minHeight: '100%',
        background: SLATE,
        color: CREAM,
        paddingBottom: 'clamp(60px, 12vh, 140px)',
      }}
    >
      <BrandMenu />

      <article
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: 'clamp(28px, 7vw, 72px) clamp(22px, 6vw, 48px) 0',
        }}
      >
        <Title />

        {SECTIONS.map((s) => (
          <div key={s.id}>
            <Prose section={s} />
            {(FIGURES_AFTER[s.id] ?? []).map((Fig, i) => (
              <div key={i} style={{ margin: 'clamp(20px, 5vw, 40px) 0' }}>
                <Fig />
              </div>
            ))}
          </div>
        ))}

        <CloseLinks />
      </article>
    </main>
  )
}

function Title() {
  return (
    <header
      style={{
        paddingBottom: 'clamp(36px, 8vw, 72px)',
        marginBottom: 'clamp(36px, 8vw, 72px)',
        borderBottom: `1px solid ${HAIR_CREAM}`,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.2em',          color: CREAM,
          opacity: 0.55,
          marginBottom: 28,
        }}
      >
        {TITLE.subtitle}
      </div>
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(44px, 9vw, 92px)',
          lineHeight: 1.02,
          letterSpacing: '-0.02em',
        }}
      >
        {TITLE.display}
      </h1>
      <p
        style={{
          margin: '28px 0 0',
          maxWidth: '54ch',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(17px, 2.4vw, 21px)',
          lineHeight: 1.5,
          color: CREAM,
          opacity: 0.82,
        }}
      >
        {TITLE.standfirst}
      </p>
      <div style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.06em' }}>
        <span style={{ color: CREAM, opacity: 0.5 }}>designed and built by </span>
        <RainbowText text={TITLE.byline} />
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.06em' }}>
        <span style={{ color: CREAM, opacity: 0.5 }}>looking to </span>
        <NatureWord>nature</NatureWord>
        <span style={{ color: CREAM, opacity: 0.5 }}> for answers</span>
      </div>
    </header>
  )
}

function Prose({ section }: { section: Section }) {
  return (
    <section
      aria-labelledby={`${section.id}-h`}
      style={{ margin: 'clamp(40px, 9vw, 96px) 0 0' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.18em',          color: STEEL_ON_SLATE,
          marginBottom: 16,
        }}
      >
        {section.eyebrow}
      </div>
      <h2
        id={`${section.id}-h`}
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
        {section.heading}
      </h2>
      {section.body.map((p, i) => (
        <p
          key={i}
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
          {p}
        </p>
      ))}
    </section>
  )
}

function CloseLinks() {
  return (
    <div
      style={{
        marginTop: 'clamp(40px, 8vw, 72px)',
        paddingTop: 'clamp(28px, 6vw, 48px)',
        borderTop: `1px solid ${HAIR_CREAM}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      <CloseLink to="/studio" label="open the studio" hint="generate · bisect · export" primary />
      <CloseLink to="/" label="back to the hero" hint="move the cursor" />
    </div>
  )
}

function CloseLink({
  to,
  label,
  hint,
  primary,
}: {
  to: string
  label: string
  hint: string
  primary?: boolean
}) {
  return (
    <Link
      to={to}
      style={{
        flex: '1 1 240px',
        textDecoration: 'none',
        border: `1px solid ${primary ? CREAM : HAIR_CREAM}`,
        background: primary ? CREAM : 'transparent',
        color: primary ? SLATE : CREAM,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'background 180ms ease, color 180ms ease',
      }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.01em' }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',          opacity: primary ? 0.7 : 0.5,
        }}
      >
        {hint}
      </span>
    </Link>
  )
}
