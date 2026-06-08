import { useStageScale } from './useStageScale'
import { ARTBOARD, HERO_COLORS, TEXT_BLOCKS, GLYPHS, SKILLS_RULE, type TextBlock } from './heroLayout'
import { MeasureLayer } from './MeasureLayer'
import { StudioGlyphLink } from './StudioGlyphLink'
import { CornerNav } from '../app/CornerNav'
import { useRef } from 'react'

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

export function Hero() {
  const stage = useStageScale()
  const stageRef = useRef<HTMLDivElement>(null)

  return (
    <main
      style={{ position: 'fixed', inset: 0, background: HERO_COLORS.slate, overflow: 'hidden' }}
    >
      <CornerNav />
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
                <span key={li} data-line={`${b.id}-${li}`} style={{ display: 'inline-block', willChange: 'transform' }}>
                  {line}
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

        <MeasureLayer stage={stage} stageRef={stageRef} />
      </div>
    </main>
  )
}
