import { useStageScale } from './useStageScale'
import { ARTBOARD, HERO_COLORS, TEXT_BLOCKS, GLYPHS, SKILLS_RULE, type TextBlock } from './heroLayout'
import { MeasureLayer } from './MeasureLayer'
import { DragLayer } from './DragLayer'
import { StudioGlyphLink } from './StudioGlyphLink'
import { CornerNav } from '../app/CornerNav'
import { useCallback, useEffect, useRef, useState } from 'react'

export type HeroMode = 'measure' | 'layout'
/** Transient/persisted placement nudge per element id, from its composition origin. */
export type Placement = Record<string, { dx: number; dy: number }>

function blockStyle(b: TextBlock): React.CSSProperties {
  return {
    position: 'absolute',
    top: b.top,
    height: b.height,
    left: b.align === 'left' ? b.anchorX : undefined,
    right: b.align === 'right' ? ARTBOARD.w - b.anchorX : undefined,
    width: 'max-content',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: b.align === 'left' ? 'flex-start' : 'flex-end',
    fontFamily: 'var(--font-display)',
    fontSize: b.fontSize,
    lineHeight: b.lineHeight,
    letterSpacing: b.letterSpacing,
    color: b.color,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }
}

/**
 * Split a line into words, interleaving real space text nodes so the rendered text is
 * byte-identical to `{line}`. Each word becomes its own reactive `data-word` span.
 */
function renderWords(blockId: string, line: string, lineIdx: number) {
  const words = line.split(' ')
  return words.map((word, wi) => (
    <span key={wi}>
      {wi > 0 ? ' ' : null}
      <span
        data-word={`${blockId}-${lineIdx}-${wi}`}
        style={{ display: 'inline-block', willChange: 'transform' }}
      >
        {word}
      </span>
    </span>
  ))
}

export function Hero() {
  const stage = useStageScale()
  const stageRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<HeroMode>('measure')
  const [placement, setPlacement] = useState<Placement>({})

  const reset = useCallback(() => setPlacement({}), [])

  // Keyboard shortcut: `L` toggles layout mode, `R` resets placements (when not typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setMode((m) => (m === 'measure' ? 'layout' : 'measure'))
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        reset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reset])

  return (
    <main
      style={{ position: 'fixed', inset: 0, background: HERO_COLORS.slate, overflow: 'hidden' }}
    >
      <CornerNav />
      <ModeToggle mode={mode} setMode={setMode} reset={reset} hasPlacements={Object.keys(placement).length > 0} />
      <div
        ref={stageRef}
        style={{
          position: 'absolute',
          left: stage.offsetX,
          top: stage.offsetY,
          width: ARTBOARD.w,
          height: ARTBOARD.h,
          transform: `scale(${stage.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {TEXT_BLOCKS.map((b) => (
          <div key={b.id} style={blockStyle(b)} data-block={b.id}>
            {b.lines.map((line, li) =>
              b.id === 'title' ? (
                <div key={li} style={{ display: 'flex' }}>
                  {[...line].map((ch, ci) => (
                    <span key={ci} data-letter={`${b.id}-${ci}`} style={{ display: 'inline-block', willChange: 'transform' }}>
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <span key={li} data-line={`${b.id}-${li}`}>
                  {renderWords(b.id, line, li)}
                </span>
              ),
            )}
          </div>
        ))}

        {GLYPHS.map((g) =>
          g.id === 'arrow-right' ? (
            <StudioGlyphLink key={g.id} glyph={g} />
          ) : (
            <span
              key={g.id}
              data-glyph={g.id}
              style={{
                position: 'absolute',
                left: g.left,
                top: g.top,
                fontFamily: 'var(--font-display)',
                fontSize: g.fontSize,
                color: HERO_COLORS.cream,
                userSelect: 'none',
              }}
            >
              {g.glyph}
            </span>
          ),
        )}

        {/* skills rule */}
        <div
          style={{
            position: 'absolute',
            left: SKILLS_RULE.x0,
            top: SKILLS_RULE.y,
            width: SKILLS_RULE.x1 - SKILLS_RULE.x0,
            height: 1,
            background: HERO_COLORS.steel,
          }}
        />

        {mode === 'measure' ? (
          <MeasureLayer stage={stage} stageRef={stageRef} placement={placement} />
        ) : (
          <DragLayer stage={stage} stageRef={stageRef} placement={placement} setPlacement={setPlacement} />
        )}
      </div>
    </main>
  )
}

/**
 * A quiet mono corner control mirroring the CornerNav language: `measure · layout`, plus a
 * reset that appears only when placements exist. Keyboard-focusable; the `L`/`R` shortcuts
 * are the fast path.
 */
function ModeToggle({
  mode,
  setMode,
  reset,
  hasPlacements,
}: {
  mode: HeroMode
  setMode: (m: HeroMode) => void
  reset: () => void
  hasPlacements: boolean
}) {
  const ink = HERO_COLORS.cream
  const item = (m: HeroMode): React.CSSProperties => ({
    color: ink,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    font: 'inherit',
    opacity: mode === m ? 1 : 0.5,
    transition: 'opacity 160ms ease',
  })

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 13px',
        borderRadius: 999,
        background: 'rgba(93, 100, 107, 0.62)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      <button
        type="button"
        aria-pressed={mode === 'measure'}
        style={item('measure')}
        onClick={() => setMode('measure')}
      >
        measure
      </button>
      <span aria-hidden style={{ width: 10, height: 1, background: ink, opacity: 0.3 }} />
      <button
        type="button"
        aria-pressed={mode === 'layout'}
        style={item('layout')}
        onClick={() => setMode('layout')}
      >
        layout
      </button>
      {hasPlacements && (
        <>
          <span aria-hidden style={{ width: 10, height: 1, background: ink, opacity: 0.3 }} />
          <button
            type="button"
            style={{ ...item('measure'), opacity: 0.7 }}
            onClick={reset}
          >
            reset
          </button>
        </>
      )}
    </div>
  )
}
