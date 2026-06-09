import { describe, it, expect } from 'vitest'
import { scorePalette, hueClusters, loptFor } from './score'
import type { Oklch } from './oklch'

/** A vivid color shorthand. */
const c = (L: number, C: number, H: number): Oklch => ({ L, C, H })

describe('hue clustering (families, not colors)', () => {
  it('merges hues within the family radius', () => {
    const clusters = hueClusters([
      { H: 10, C: 0.1 },
      { H: 24, C: 0.1 },
      { H: 200, C: 0.1 },
    ])
    expect(clusters.length).toBe(2)
  })

  it('merges across the 0° wrap', () => {
    const clusters = hueClusters([
      { H: 355, C: 0.1 },
      { H: 6, C: 0.1 },
    ])
    expect(clusters.length).toBe(1)
  })
})

describe('natural lightness lookup', () => {
  it('knows yellow lives light and blue lives deep', () => {
    expect(loptFor(95)).toBeGreaterThan(0.7) // yellow's chroma peaks near-white
    expect(loptFor(264)).toBeLessThan(0.6) // blue's chroma peaks deep
    for (const h of [0, 45, 130, 220, 300, 359.5]) {
      const l = loptFor(h)
      expect(l).toBeGreaterThan(0)
      expect(l).toBeLessThan(1)
    }
  })
})

describe('every genre has a road to a high score', () => {
  it('a 6-color triad is judged as 3 families, not damped as 6 scattered hues', () => {
    // three tight pairs at 0/120/240 — the classic triad the old color-counting damp punished
    const triad = [c(0.25, 0.13, 5), c(0.4, 0.14, 10), c(0.55, 0.13, 125), c(0.68, 0.15, 130), c(0.8, 0.12, 245), c(0.88, 0.11, 250)]
    const s = scorePalette(triad)
    expect(s.harmony).toBeGreaterThan(0.55)
    expect(s.total).toBeGreaterThan(0.7)
  })

  it('a high-key pastel passes contrast on its narrower, deliberate band', () => {
    const pastel = [c(0.62, 0.07, 20), c(0.68, 0.09, 40), c(0.74, 0.06, 60), c(0.8, 0.08, 30), c(0.85, 0.07, 50), c(0.9, 0.05, 45)]
    const s = scorePalette(pastel)
    expect(s.contrast).toBeGreaterThan(0.6)
  })

  it('a low-key moody palette passes contrast, vibrancy and mud on dark-appropriate terms', () => {
    // genuinely separated darks (the engine's dedupe floor is 0.08; a stack of near-twins should
    // NOT pass — that's the separation gate working, not a genre bias)
    const moody = [c(0.2, 0.1, 264), c(0.28, 0.12, 300), c(0.36, 0.11, 245), c(0.43, 0.13, 285), c(0.5, 0.09, 225)]
    const s = scorePalette(moody)
    expect(s.contrast).toBeGreaterThan(0.6)
    expect(s.vibrancy).toBeGreaterThan(0.6)
    expect(s.antiMud).toBeGreaterThan(0.8)
    expect(s.total).toBeGreaterThan(0.65)
  })

  it('a gradual sunset ramp earns harmony through the ramp road', () => {
    // hue travels ~90° monotonically with lightness, violet → dawn gold, in gradual steps
    const ramp = [c(0.3, 0.11, 290), c(0.42, 0.12, 308), c(0.54, 0.13, 326), c(0.66, 0.13, 344), c(0.78, 0.12, 2), c(0.88, 0.1, 20)]
    const s = scorePalette(ramp)
    expect(s.harmony).toBeGreaterThan(0.5)
    expect(s.total).toBeGreaterThan(0.7)
  })
})

describe('pigment: colors near their hue\'s natural lightness read clean', () => {
  it('punishes dark yellow (olive mud) but not the same hues placed light', () => {
    const dark = [c(0.3, 0.09, 100), c(0.34, 0.09, 95), c(0.38, 0.1, 105), c(0.6, 0.03, 100), c(0.75, 0.03, 95), c(0.88, 0.02, 100)]
    const light = [c(0.78, 0.09, 100), c(0.82, 0.09, 95), c(0.86, 0.1, 105), c(0.5, 0.03, 100), c(0.35, 0.03, 95), c(0.2, 0.02, 100)]
    expect(scorePalette(dark).pigment).toBeLessThan(scorePalette(light).pigment - 0.25)
  })
})

describe('duds still fail (the cross-checks survived the new roads)', () => {
  it('a lone vivid chip among grays cannot ride any road to a high score', () => {
    const chip = [c(0.6, 0.2, 30), c(0.2, 0.01, 0), c(0.4, 0.012, 90), c(0.55, 0.015, 180), c(0.75, 0.01, 270), c(0.9, 0.008, 45)]
    expect(scorePalette(chip).total).toBeLessThan(0.65)
  })

  it('a 5+-family scatter is damped, not rewarded as "even spacing"', () => {
    const scatter = [c(0.3, 0.12, 0), c(0.45, 0.13, 60), c(0.55, 0.12, 125), c(0.65, 0.13, 185), c(0.75, 0.12, 250), c(0.85, 0.11, 310)]
    const triad = [c(0.3, 0.12, 5), c(0.45, 0.13, 10), c(0.55, 0.12, 125), c(0.65, 0.13, 130), c(0.75, 0.12, 245), c(0.85, 0.11, 250)]
    expect(scorePalette(scatter).harmony).toBeLessThan(scorePalette(triad).harmony)
  })
})
