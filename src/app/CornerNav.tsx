import { Link, useLocation } from 'react-router-dom'

const CREAM = '#f4f0e8'

const LINKS: { to: string; label: string }[] = [
  { to: '/', label: 'hero' },
  { to: '/studio', label: 'studio' },
  { to: '/case', label: 'case' },
]

/**
 * A tiny fixed corner nav between the three surfaces. Mono, hairline, restrained — present
 * but quiet, so it never competes with the hero or the composition. The current route reads
 * at full opacity; the rest sit back.
 *
 * `tone` lets a cream-background page (the case study) flip the ink to slate.
 */
export function CornerNav({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { pathname } = useLocation()
  const ink = tone === 'dark' ? '#5d646b' : CREAM

  return (
    <nav
      aria-label="Surfaces"
      style={{
        position: 'fixed',
        top: 20,
        right: 22,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        mixBlendMode: 'normal',
      }}
    >
      {LINKS.map((l, i) => {
        const current = l.to === '/' ? pathname === '/' : pathname.startsWith(l.to)
        return (
          <span key={l.to} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {i > 0 && (
              <span aria-hidden style={{ width: 10, height: 1, background: ink, opacity: 0.3 }} />
            )}
            <Link
              to={l.to}
              aria-current={current ? 'page' : undefined}
              style={{
                color: ink,
                textDecoration: 'none',
                opacity: current ? 1 : 0.5,
                transition: 'opacity 160ms ease',
              }}
              onPointerEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onPointerLeave={(e) => (e.currentTarget.style.opacity = current ? '1' : '0.5')}
            >
              {l.label}
            </Link>
          </span>
        )
      })}
    </nav>
  )
}
