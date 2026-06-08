import type { Module } from '../types'

/** Index of the largest-area module — the next cell a subdivision generator will split. */
export function largestIndex(modules: Module[]): number {
  let idx = 0
  for (let i = 1; i < modules.length; i++) {
    if (modules[i].w * modules[i].h > modules[idx].w * modules[idx].h) idx = i
  }
  return idx
}
