import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HERO_COLORS, type Glyph } from './heroLayout'

/**
 * The hero's `→` glyph, promoted to a keyboard-focusable link into the studio.
 * Faithful to the Figma at rest (a bare cream arrow); on hover/focus it earns a
 * subtle cream underline + a measure tick + a whispered label — discoverable,
 * never disruptive.
 */
export function StudioGlyphLink({ glyph }: { glyph: Glyph }) {
  const [active, setActive] = useState(false)

  return (
    <Link
      to="/studio"
      data-glyph={glyph.id}
      aria-label="Open the studio"
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      style={{
        position: 'absolute',
        left: glyph.left,
        top: glyph.top,
        fontFamily: 'var(--font-display)',
        fontSize: glyph.fontSize,
        lineHeight: 1,
        color: HERO_COLORS.cream,
        textDecoration: 'none',
        userSelect: 'none',
        outline: 'none',
        cursor: 'pointer',
        display: 'inline-block',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {glyph.glyph}
        {/* underline grows from the left on hover/focus */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 2,
            right: 2,
            bottom: -2,
            height: 1.5,
            background: HERO_COLORS.cream,
            transformOrigin: 'left center',
            transform: `scaleX(${active ? 1 : 0})`,
            transition: 'transform 260ms cubic-bezier(.22,1,.36,1)',
          }}
        />
        {/* measure tick + whispered label, in the dimension-arrow vocabulary */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: active ? 1 : 0,
            transition: 'opacity 220ms ease',
            pointerEvents: 'none',
          }}
        >
          <span style={{ width: 18, height: 1, background: HERO_COLORS.cream }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: HERO_COLORS.cream,
              whiteSpace: 'nowrap',
            }}
          >
            studio
          </span>
        </span>
      </span>
    </Link>
  )
}
