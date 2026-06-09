import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

/*
 * The site's in-brand navigation: a top-right wordmark that doubles as a drop-DOWN menu, persistent
 * across every surface (it replaces the old corner pill). "Chickpea" is the constant wordmark (cream;
 * links home); beside it sits the CURRENT surface as a dark chip, and on hover the menu expands
 * downward to reveal the others. Mafinest, tight tracking, the green chip palette from the Figma.
 */

const CREAM = '#f4f0e8'
const CHIP = '#313131'
const SELECTED = '#8d9a7a' // the current surface
const HOVER = '#aeb89a' // the surface under the pointer
const IDLE = '#737d73' // a surface at rest

interface Item {
  to: string
  label: string
}

// the three surfaces, in menu order. the current one is the anchor; the rest drop down on hover.
const ITEMS: Item[] = [
  { to: '/', label: 'hero' },
  { to: '/studio', label: 'studio' },
  { to: '/case', label: 'case' },
]

const FS = 32
const chip: React.CSSProperties = {
  display: 'block',
  background: CHIP,
  padding: '1px 10px 4px',
  textDecoration: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: FS,
  lineHeight: 1.05,
  letterSpacing: '-0.05em',
  textAlign: 'right',
  transition: 'color 160ms ease',
}

export function BrandMenu() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  // the current surface is the anchor; everything else drops down. exact match for hero ("/"),
  // prefix match for the others, so the displayed option always reflects the page.
  const idx = ITEMS.findIndex((it) => (it.to === '/' ? pathname === '/' : pathname.startsWith(it.to)))
  const currentIdx = idx < 0 ? 0 : idx
  const current = ITEMS[currentIdx]
  const others = ITEMS.filter((_, i) => i !== currentIdx)

  const colorOf = (it: Item, isCurrent: boolean): string =>
    hovered === it.label ? HOVER : isCurrent ? SELECTED : IDLE

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
        top: 12,
        right: 14,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.14em',
        // a faint slate-blur backdrop: invisible over the solid hero/studio, but it masks body text
        // scrolling under the menu on the case study (same trick the old corner pill used)
        padding: '4px 12px 7px',
        borderRadius: 16,
        background: 'rgba(93, 100, 107, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-display)',
        fontSize: FS,
        lineHeight: 1.05,
        letterSpacing: '-0.05em',
      }}
    >
      <Link to="/" style={{ color: CREAM, textDecoration: 'none', padding: '1px 0 4px' }}>
        Chickpea
      </Link>
      <span style={{ position: 'relative', display: 'inline-block' }}>
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
        {/* the other surfaces, drop DOWN from the anchor (right-aligned, nearest just below it) */}
        <span
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 3,
            marginTop: 3,
            transformOrigin: 'top right',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.98)',
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
      </span>
    </nav>
  )
}
