import { describe, it, expect } from 'vitest'
import { compositionToSvg } from './export-svg'
import { exportFilename } from './filename'
import { generate } from '../grid/generators'
import { generatePalette } from '../palette/generate'
import { buildComposition } from '../studio/composition'

describe('compositionToSvg', () => {
  const grid = generate('recursive', 11)
  const pal = generatePalette(11, 6)
  const comp = buildComposition(grid, pal, { seed: 11, textChance: 0.4 })

  it('includes the background color, one rect per module, and the seed in <desc>', () => {
    const svg = compositionToSvg(comp, grid, { width: 800, height: 800 })
    // background fill present
    expect(svg).toContain(comp.background)
    // a rect per module (+1 background rect)
    const rectCount = (svg.match(/<rect/g) ?? []).length
    expect(rectCount).toBe(grid.modules.length + 1)
    // seed in metadata
    expect(svg).toContain('<desc>')
    expect(svg).toContain(`seed ${grid.seed}`)
    expect(svg).toContain('<title>Chickpea</title>')
  })

  it('is a standalone svg document', () => {
    const svg = compositionToSvg(comp, grid, { width: 400, height: 400 })
    expect(svg.trimStart().startsWith('<svg')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('embeds a font face when a data url is supplied', () => {
    const svg = compositionToSvg(comp, grid, { width: 400, height: 400, fontDataUrl: 'data:font/otf;base64,AAAA' })
    expect(svg).toContain('@font-face')
    expect(svg).toContain('data:font/otf;base64,AAAA')
  })
})

describe('exportFilename', () => {
  it('formats chickpea-YYYYMMDD-HHMMSS.ext from an injected date', () => {
    const d = new Date(2026, 5, 8, 9, 4, 7) // 2026-06-08 09:04:07 (month is 0-based)
    expect(exportFilename('svg', d)).toBe('chickpea-20260608-090407.svg')
    expect(exportFilename('png', d)).toBe('chickpea-20260608-090407.png')
  })
})
