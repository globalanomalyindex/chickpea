import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

/*
 * The studio's in-brand navigation: a bottom-left wordmark that doubles as a drop-up menu.
 * "Chickpea" is the constant wordmark (the one capitalized word; it links home). Beside it sits the
 * current surface as a dark chip; on hover the menu expands UPWARD to reveal the other surfaces.
 * Mafinest, tight tracking, the green/steel chip palette from the Figma blocking (node 35:3).
 */

const CREAM = '#f4f0e8'
const CHIP = '#313131'
const SELECTED = '#8d9a7a' // the current surface
const HOVER = '#aeb89a' // the word under the pointer
const IDLE = '#737d73' // an unselected surface at rest
const STEEL = '#4e6a7a' // skills (a section of the hero), held apart in the steel accent

interface Item {
  to: string
  label: string
  steel?: boolean
}

// surfaces, in menu order. "skills" is a section of the hero, so it routes there.
const ITEMS: Item[] = [
  { to: '/studio', label: 'studio' },
  { to: '/case', label: 'case' },
  { to: '/', label: 'skills', steel: true },
]

const chip: React.CSSProperties = {
  display: 'block',
  background: CHIP,
  padding: '1px 10px 4px',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: 36,
  lineHeight: 1.05,
  letterSpacing: '-0.06em',
  transition: 'color 160ms ease',
}

export function BrandMenu() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const idx = ITEMS.findIndex((it) => (it.to === '/' ? pathname === '/' : pathname.startsWith(it.to)))
  const currentIdx = idx < 0 ? 0 : idx
  const current = ITEMS[currentIdx]
  const others = ITEMS.filter((_, i) => i !== currentIdx)

  const colorOf = (it: Item, isCurrent: boolean): string =>
    hovered === it.label ? HOVER : isCurrent ? SELECTED : it.steel ? STEEL : IDLE

  return (
    <nav
      aria-label="pages"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        setOpen(false)
        setHovered(null)
      }}
      style={{
        position: 'fixed',
        // anchored at the canvas's bottom-left (clearing the 268px settings rail) so it never sits
        // over the scrolling controls, and the drop-up can expand freely outside any clipped overflow
        left: 292,
        bottom: 18,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0.14em',
        fontFamily: 'var(--font-display)',
        fontSize: 36,
        lineHeight: 1.05,
        letterSpacing: '-0.06em',
      }}
    >
      <Link to="/" style={{ color: CREAM, textDecoration: 'none', paddingBottom: 4 }}>
        Chickpea
      </Link>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {/* the other surfaces, drop-UP from the anchor (nearest sits just above it) */}
        <span
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: 3,
            marginBottom: 3,
            transformOrigin: 'bottom left',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
            pointerEvents: open ? 'auto' : 'none',
            transition:
              'opacity 200ms cubic-bezier(0.23,1,0.32,1), transform 200ms cubic-bezier(0.23,1,0.32,1)',
          }}
        >
          {others.map((it) => (
            <Link
              key={it.label}
              to={it.to}
              onPointerEnter={() => setHovered(it.label)}
              onPointerLeave={() => setHovered((v) => (v === it.label ? null : v))}
              style={{ ...chip, color: colorOf(it, false) }}
            >
              {it.label}
            </Link>
          ))}
        </span>
        {/* anchor: the current surface */}
        <Link
          to={current.to}
          aria-current="page"
          onPointerEnter={() => setHovered(current.label)}
          onPointerLeave={() => setHovered((v) => (v === current.label ? null : v))}
          style={{ ...chip, color: colorOf(current, true) }}
        >
          {current.label}
        </Link>
      </span>
    </nav>
  )
}
