import { Fragment } from 'react'
import { TintWord } from '../components/colorWords'
import { REF_INDEX } from './content'

/**
 * Inline markup for the case-study prose, so the writing stays plain text in content.ts while the
 * page can paint natural words and footnote technical claims:
 *
 *   {{word}}            a natural noun, painted letter-by-letter in the colors of the thing it names
 *   {{display|ramp}}    same, but the visible text differs from the ramp key (e.g. a Japanese term)
 *   [[ref-id]]          a superscript citation, linked to its entry in the references list
 *
 * Marking words by hand (rather than auto-scanning) keeps it context-correct: "leaf" the plant is
 * painted, "leaf through" would not be.
 */
const TOKEN = /(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g

export function renderProse(text: string): React.ReactNode[] {
  const parts = text.split(TOKEN)
  return parts.map((part, i) => {
    if (part.startsWith('{{')) {
      const inner = part.slice(2, -2)
      const [display, ramp] = inner.split('|')
      return <TintWord key={i} ramp={ramp}>{display}</TintWord>
    }
    if (part.startsWith('[[')) {
      const id = part.slice(2, -2)
      const n = REF_INDEX[id]
      if (!n) return <Fragment key={i} />
      return (
        <a
          key={i}
          href={`#ref-${id}`}
          aria-label={`reference ${n}`}
          style={{
            fontSize: '0.62em',
            verticalAlign: 'super',
            lineHeight: 0,
            textDecoration: 'none',
            color: 'inherit',
            opacity: 0.6,
            padding: '0 0.5px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {n}
        </a>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
