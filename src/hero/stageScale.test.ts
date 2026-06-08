import { describe, it, expect } from 'vitest'
import { computeStage, clientToStage } from './stageScale'

const ART = { w: 758, h: 1024 }

describe('computeStage (contain fit, centered)', () => {
  it('fits to height on a wide viewport and centers horizontally', () => {
    const s = computeStage(2000, 1024, ART)
    expect(s.scale).toBeCloseTo(1, 6) // 1024/1024
    expect(s.offsetX).toBeCloseTo((2000 - 758) / 2, 6)
    expect(s.offsetY).toBeCloseTo(0, 6)
  })

  it('fits to width on a tall/narrow viewport and centers vertically', () => {
    const s = computeStage(379, 2000, ART)
    expect(s.scale).toBeCloseTo(0.5, 6) // 379/758
    expect(s.offsetY).toBeCloseTo((2000 - 1024 * 0.5) / 2, 6)
    expect(s.offsetX).toBeCloseTo(0, 6)
  })
})

describe('clientToStage', () => {
  it('inverts the transform: a client point maps back to artboard coords', () => {
    const stage = computeStage(2000, 1024, ART) // scale 1, offsetX 621, offsetY 0
    const p = clientToStage(stage.offsetX + 100, stage.offsetY + 200, stage)
    expect(p.x).toBeCloseTo(100, 6)
    expect(p.y).toBeCloseTo(200, 6)
  })

  it('accounts for scale', () => {
    const stage = computeStage(379, 2000, ART) // scale 0.5
    const p = clientToStage(stage.offsetX + 50, stage.offsetY + 50, stage)
    expect(p.x).toBeCloseTo(100, 6) // 50 / 0.5
    expect(p.y).toBeCloseTo(100, 6)
  })
})
