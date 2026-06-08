import type { Stage } from './stageScale'
import type { Box } from './measurements'

/** Shared snappy curve — replaces the old 260ms clunk. Immediate + lively. */
export const FAST_EASE = 'transform 120ms cubic-bezier(.2,.9,.25,1)'

export interface PlacementMap {
  [id: string]: { dx: number; dy: number }
}

/** Every reactive element id we apply transforms to (words, title letters, blocks). */
export interface ReactiveEls {
  letters: HTMLElement[]
  words: HTMLElement[]
  blocks: HTMLElement[]
}

export function queryReactiveEls(root: HTMLElement): ReactiveEls {
  return {
    letters: [...root.querySelectorAll<HTMLElement>('[data-letter^="title-"]')],
    words: [...root.querySelectorAll<HTMLElement>('[data-word]')],
    blocks: [...root.querySelectorAll<HTMLElement>('[data-block]')],
  }
}

/**
 * Measure all reactive boxes in ARTBOARD coordinates. Each element's
 * getBoundingClientRect is expressed relative to the (scaled) stage root rect and divided
 * by stage.scale. The currently-applied translate (placement + transient nudge) is passed
 * back out via `applied` so boxes always describe the RESTING composition, never a moving
 * target. Words are `kind:'word'`, title letters `kind:'letter'`, blocks `kind:'block'`.
 */
export function measureBoxes(
  root: HTMLElement,
  stage: Stage,
  applied: Map<string, { dx: number; dy: number }>,
): Box[] {
  const stageRect = root.getBoundingClientRect()
  const out: Box[] = []

  const push = (el: HTMLElement, id: string, kind: Box['kind']) => {
    const r = el.getBoundingClientRect()
    const off = applied.get(id) ?? { dx: 0, dy: 0 }
    out.push({
      id,
      kind,
      x: (r.left - stageRect.left) / stage.scale - off.dx,
      y: (r.top - stageRect.top) / stage.scale - off.dy,
      w: r.width / stage.scale,
      h: r.height / stage.scale,
    })
  }

  const els = queryReactiveEls(root)
  for (const el of els.letters) push(el, el.dataset.letter!, 'letter')
  for (const el of els.words) push(el, el.dataset.word!, 'word')
  for (const el of els.blocks) push(el, el.dataset.block!, 'block')
  return out
}

/**
 * Apply `dx,dy` translate to an element (in artboard px), writing it back into `applied`
 * so the next measurement subtracts it out. `instant` skips the transition (used while
 * actively dragging so the element pins to the pointer with zero lag).
 */
export function applyTransform(
  el: HTMLElement,
  id: string,
  dx: number,
  dy: number,
  applied: Map<string, { dx: number; dy: number }>,
  instant = false,
) {
  el.style.transition = instant ? 'none' : FAST_EASE
  el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : ''
  applied.set(id, { dx, dy })
}
