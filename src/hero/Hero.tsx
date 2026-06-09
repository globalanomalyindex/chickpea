import { useStageScale } from './useStageScale'
import { ARTBOARD, HERO_COLORS, TEXT_BLOCKS, GLYPHS, SKILLS_RULE, type TextBlock } from './heroLayout'
import { MorphGrid } from './MorphGrid'
import { InteractionLayer } from './InteractionLayer'
import { StudioGlyphLink } from './StudioGlyphLink'
import { CornerNav } from '../app/CornerNav'
import { useCallback, useEffect, useRef, useState } from 'react'

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

  const [placement, setPlacement] = useState<Placement>({})

  /** 0..1 interaction intensity + live cursor — shared between the InteractionLayer (writer)
   * and the MorphGrid (reader), purely via refs so neither re-renders in the hot path. */
  const activityRef = useRef(0)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  /** Live placed word/block boxes + a change counter — the InteractionLayer publishes the current
   * composition here and the MorphGrid anchors its grid to it, so the negative-space grid always
   * reflects (and works with) the arrangement as the user moves things. Refs: no hot-path renders. */
  const compositionRef = useRef<{ x: number; y: number; w: number; h: number }[]>([])
  const compositionVersion = useRef(0)

  const reset = useCallback(() => setPlacement({}), [])

  // Keyboard shortcut: `R` resets placements (when not typing). No mode toggle — one mode.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        reset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reset])

  const hasPlacements = Object.keys(placement).length > 0

  return (
    <main
      style={{ position: 'fixed', inset: 0, background: HERO_COLORS.slate, overflow: 'hidden' }}
    >
      <CornerNav />
      {hasPlacements && <ResetControl reset={reset} />}
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
        <MorphGrid
          activityRef={activityRef}
          cursorRef={cursorRef}
          compositionRef={compositionRef}
          compositionVersion={compositionVersion}
        />

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

        <InteractionLayer
          stage={stage}
          stageRef={stageRef}
          placement={placement}
          setPlacement={setPlacement}
          activityRef={activityRef}
          cursorRef={cursorRef}
          compositionRef={compositionRef}
          compositionVersion={compositionVersion}
        />
      </div>
    </main>
  )
}

/**
 * A quiet mono corner control mirroring the CornerNav language: a single `reset` that appears
 * only when placements exist. The `R` shortcut is the fast path.
 */
function ResetControl({ reset }: { reset: () => void }) {
  const ink = HERO_COLORS.cream
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
        onClick={reset}
        style={{
          color: ink,
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          opacity: 0.7,
          transition: 'opacity 160ms ease',
        }}
      >
        reset
      </button>
    </div>
  )
}
