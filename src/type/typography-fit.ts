export interface LineFit {
  text: string
  scaleX: number
  scaleY: number
}
export interface TextFit {
  lines: LineFit[]
  innerW: number
  innerH: number
}

export interface FitParams {
  text: string
  width: number
  height: number
  measure: (line: string) => number // intrinsic width at refSize
  refSize: number
  lineHeight: number
  padding: number // fraction 0..0.5 of each axis (both sides)
}

export function fitText(p: FitParams): TextFit {
  const lines = p.text.split('\n')
  const innerW = p.width * (1 - 2 * p.padding)
  const innerH = p.height * (1 - 2 * p.padding)
  const widths = lines.map((l) => Math.max(1, p.measure(l)))
  const maxW = Math.max(...widths)
  const globalScaleX = innerW / maxW
  const globalScaleY = innerH / (lines.length * p.refSize * p.lineHeight)
  return {
    innerW,
    innerH,
    lines: lines.map((text, i) => ({
      text,
      scaleX: globalScaleX * (maxW / widths[i]),
      scaleY: globalScaleY,
    })),
  }
}
