import type { ColorWeight } from '../palette/kmeans'
import type { PaletteColor } from '../palette/generate'
import { rgbToHex, rgbToHsl } from '../palette/hsl'

/**
 * Wrap an image-derived `ColorWeight[]` (from k-means) into the studio's `PaletteColor`
 * shape so `buildComposition` / `CompositionSvg` / export consume it unchanged. The hex
 * comes from `rgbToHex`; h/s/l are computed from the rgb so the reveal annotations stay
 * truthful. Colors are kept in descending-weight order (k-means already sorts them); the
 * last (lowest-weight) color becomes the composition background, matching the generated
 * palette convention.
 */
export function imagePaletteToPalette(colors: ColorWeight[]): PaletteColor[] {
  return colors.map((c) => {
    const [h, s, l] = rgbToHsl(c.rgb)
    return { hex: rgbToHex(c.rgb), rgb: c.rgb, h, s, l, weight: c.weight }
  })
}
