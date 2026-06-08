export type Axis = 'v' | 'h'

export interface Guide {
  axis: Axis
  pos: number // normalized 0..1
}

export interface Module {
  x: number
  y: number
  w: number
  h: number // all normalized 0..1
}

export interface RatioRef {
  name: string
  value: number
}

export type GeneratorKind = 'recursive' | 'modular' | 'nature'

export interface RecursiveParams {
  kind: 'recursive'
  targetModules: number
  splitRatios: number[]
  vBias: number // probability a split is vertical (cuts along x)
}

export interface ModularParams {
  kind: 'modular'
  columns: number
  rows: number
  margin: number
  gutter: number
}

export interface NatureParams {
  kind: 'nature'
  depth: number
}

export type GeneratorParams = RecursiveParams | ModularParams | NatureParams

export interface Grid {
  id: string
  seed: number
  generator: GeneratorKind
  params: GeneratorParams
  aspect: number
  guides: Guide[]
  modules: Module[]
  ratios: RatioRef[]
  meta: Record<string, unknown>
}
