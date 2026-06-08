export interface Artboard { w: number; h: number }
export interface Stage { scale: number; offsetX: number; offsetY: number }
export interface Point { x: number; y: number }

/** Uniform "contain" fit of the artboard into the viewport, centered. */
export function computeStage(vw: number, vh: number, art: Artboard): Stage {
  const scale = Math.min(vw / art.w, vh / art.h)
  const offsetX = (vw - art.w * scale) / 2
  const offsetY = (vh - art.h * scale) / 2
  return { scale, offsetX, offsetY }
}

/** Map a client/viewport point into artboard coordinates. */
export function clientToStage(clientX: number, clientY: number, stage: Stage): Point {
  return {
    x: (clientX - stage.offsetX) / stage.scale,
    y: (clientY - stage.offsetY) / stage.scale,
  }
}
