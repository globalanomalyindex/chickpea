export const ARTBOARD = { w: 758, h: 1024 } as const

export const HERO_COLORS = {
  slate: '#5d646b',
  cream: '#f4f0e8',
  steel: '#4e6a7a',
} as const

export interface TextBlock {
  id: string
  lines: string[]
  fontSize: number
  letterSpacing: number
  lineHeight: number
  color: string
  align: 'left' | 'right'
  /** Anchor edge in artboard px. For align:'right' this is the right edge; for 'left', the left edge. */
  anchorX: number
  /** Top of the block's box in artboard px. */
  top: number
  /** Box height in artboard px (text is bottom-anchored within it). */
  height: number
}

export const TITLE: TextBlock = {
  id: 'title',
  lines: ['Chickpea'],
  fontSize: 200,
  letterSpacing: -20,
  lineHeight: 1.088,
  color: HERO_COLORS.cream,
  align: 'right',
  anchorX: 735,
  top: 686,
  height: 218,
}

export const GRID_GENERATOR: TextBlock = {
  id: 'grid-generator',
  lines: ['grid generator', 'by christopher robin fiore'],
  fontSize: 48,
  letterSpacing: -4.8,
  lineHeight: 1.04,
  color: HERO_COLORS.cream,
  align: 'right',
  anchorX: 735,
  top: 547,
  height: 123,
}

export const PORTFOLIO: TextBlock = {
  id: 'portfolio',
  lines: ['portfolio theme:', 'looking to nature for answers'],
  fontSize: 48,
  letterSpacing: -4.8,
  lineHeight: 1.04,
  color: HERO_COLORS.cream,
  align: 'left',
  anchorX: 38,
  top: 864,
  height: 123,
}

export const SKILLS: TextBlock = {
  id: 'skills',
  lines: ['skills'],
  fontSize: 32,
  letterSpacing: -3.2,
  lineHeight: 1.0,
  color: HERO_COLORS.steel,
  align: 'right',
  anchorX: 226,
  top: 1005,
  height: 35,
}

export interface Glyph {
  id: string
  glyph: string
  fontSize: number
  left: number
  top: number
}

export const ARROW_RIGHT: Glyph = { id: 'arrow-right', glyph: '→', fontSize: 40, left: 23, top: 586 }
export const ARROW_LEFT: Glyph = { id: 'arrow-left', glyph: '←', fontSize: 40, left: 695, top: 951 }

export const SKILLS_RULE = { x0: 0, x1: 226, y: 1052 } as const

export const TEXT_BLOCKS: TextBlock[] = [GRID_GENERATOR, TITLE, PORTFOLIO, SKILLS]
export const GLYPHS: Glyph[] = [ARROW_RIGHT, ARROW_LEFT]
