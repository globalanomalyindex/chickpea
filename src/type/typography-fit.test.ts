import { describe, it, expect } from 'vitest'
import { fitText } from './typography-fit'

// mock measurer: width = chars * 10 at the reference size
const measure = (line: string) => line.length * 10

describe('fitText', () => {
  it('fills width: widest line scales to the inner width', () => {
    const f = fitText({ text: 'AB', width: 200, height: 100, measure, refSize: 100, lineHeight: 1, padding: 0 })
    // 'AB' intrinsic width 20 -> globalScaleX = 200/20 = 10
    expect(f.lines[0].scaleX).toBeCloseTo(10, 5)
  })

  it('fills height across N lines', () => {
    const f = fitText({ text: 'A\nBB', width: 200, height: 200, measure, refSize: 100, lineHeight: 1, padding: 0 })
    // 2 lines, refSize 100, lineHeight 1 -> stack height 200 -> globalScaleY = 200/200 = 1
    expect(f.lines[0].scaleY).toBeCloseTo(1, 5)
    // per-line normalize: line 'A'(10) widened to match widest 'BB'(20) before global
    expect(f.lines[0].scaleX / f.lines[1].scaleX).toBeCloseTo(2, 5)
  })

  it('respects padding (fraction of the rect)', () => {
    const f = fitText({ text: 'A', width: 200, height: 100, measure, refSize: 100, lineHeight: 1, padding: 0.1 })
    // inner width = 200*(1-0.2)=160; 'A'=10 -> 16
    expect(f.lines[0].scaleX).toBeCloseTo(16, 5)
  })
})
