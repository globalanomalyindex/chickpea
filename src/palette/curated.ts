/**
 * Curated real-world anchor palettes — the "soul" behind the botanical / fauna / nature moods.
 *
 * These are not the palettes the generator emits; they are SEEDS. A recipe picks one set, selects a
 * spread of its colors for the requested count, then perturbs every color in OKLCH (small ΔL, ΔC,
 * ΔH). So "beet" never comes out byte-identical twice — each generation is a fresh variation on the
 * same evocative source — yet it always reads as that thing. This is the anchor-and-jitter trick:
 * curation supplies taste and a recognizable *feel*; the seeded perturbation supplies endless
 * variety. Authored as hex (legible, easy to eyeball); converted to OKLCH once at load.
 */

export interface CuratedSet {
  name: string
  colors: string[]
}

export type CuratedCategory = 'botanical' | 'fauna' | 'landscape'

const BOTANICAL: CuratedSet[] = [
  { name: 'carrot', colors: ['#E8702A', '#F2A84B', '#5C7A35', '#2E4022', '#EAD9B0'] },
  { name: 'beet', colors: ['#7A1F3D', '#B23A5E', '#D07E9C', '#4C7A38', '#E7D9C2'] },
  { name: 'eggplant', colors: ['#3A2348', '#5E3A6E', '#9A7CB0', '#C7B45E', '#2E3A22'] },
  { name: 'pepper', colors: ['#C5202B', '#E8861E', '#F2D024', '#3C8C3C', '#7A1F2B'] },
  { name: 'tomato', colors: ['#D8382C', '#E86A3A', '#F0C24A', '#5C7A35', '#2C3A1E'] },
  { name: 'radish', colors: ['#C83B63', '#E483A2', '#F3E7D8', '#74A03C', '#3A5A2A'] },
  { name: 'squash', colors: ['#F2C430', '#E2902B', '#C26A28', '#7BA05B', '#43602F'] },
  { name: 'pea', colors: ['#7BA05B', '#A8C36B', '#4C7A3A', '#2E4A24', '#E7E2C8'] },
  { name: 'cabbage', colors: ['#5E4E8E', '#8A6FB0', '#B49AD0', '#6FA03C', '#D8D2BE'] },
  { name: 'chili', colors: ['#9A1B1B', '#C5202B', '#E0521E', '#2E5A2A', '#1E2A18'] },
]

const FAUNA: CuratedSet[] = [
  { name: 'fox', colors: ['#C5551F', '#E08A4A', '#F2E4CE', '#3A2A22', '#8A4A28'] },
  { name: 'peacock', colors: ['#0E6E78', '#0A5A8C', '#13967E', '#C9A227', '#26324A'] },
  { name: 'flamingo', colors: ['#E8748E', '#F2A9B8', '#F4D9C0', '#D14E6E', '#5A8A6A'] },
  { name: 'mallard', colors: ['#16463A', '#1E7A6E', '#2C5A8C', '#8A6A3A', '#E3D8C2'] },
  { name: 'tiger', colors: ['#D87A1E', '#2A2018', '#E8C98A', '#A0481A', '#F2E6D2'] },
  { name: 'toucan', colors: ['#1A1614', '#E8851E', '#F2C81E', '#1E8C5A', '#D63A2E'] },
  { name: 'robin', colors: ['#2C6E8C', '#D9743A', '#E8D9C2', '#3A4A3A', '#A05A2A'] },
  { name: 'koi', colors: ['#E85A2A', '#F2EDE6', '#1E1A18', '#D9A227', '#B23A2A'] },
  { name: 'jay', colors: ['#2A4E8C', '#4E7AC0', '#A9C2E0', '#1A1E2A', '#D8D2C2'] },
  { name: 'gecko', colors: ['#3A8C4A', '#8AC23C', '#D9D24A', '#2A4A2A', '#E2C98A'] },
]

const LANDSCAPE: CuratedSet[] = [
  { name: 'coast', colors: ['#1E5A78', '#3E8AA0', '#9CC4CE', '#E3D7BE', '#C28A4A'] },
  { name: 'forest', colors: ['#23402A', '#3E6B3A', '#6E9A4A', '#A9B86A', '#D8D2A8'] },
  { name: 'desert', colors: ['#C98A4A', '#E3B97A', '#F2E2C2', '#A85A3A', '#6E5A42'] },
  { name: 'autumn', colors: ['#9A3A1E', '#C9682A', '#E8A53A', '#D9C24A', '#3A4A22'] },
  { name: 'meadow', colors: ['#4C7A3A', '#86A83C', '#D9C84A', '#E8748E', '#3A5A6A'] },
  { name: 'dusk', colors: ['#2A2A4A', '#5A3A6E', '#B05A7A', '#E89A6A', '#F2D8A8'] },
  { name: 'glacier', colors: ['#2C5A6E', '#5E97A8', '#A8C9D2', '#EAEFF0', '#7A8A92'] },
  { name: 'volcanic', colors: ['#241A1A', '#7A2A1E', '#C9481E', '#E8902A', '#D9C2A8'] },
  { name: 'lagoon', colors: ['#0E5A5A', '#13897E', '#5EC2B0', '#D9E8DE', '#C2A24A'] },
  { name: 'canyon', colors: ['#7A2E1E', '#B0542A', '#D98A4A', '#E8C98A', '#3A2A24'] },
]

export const CURATED: Record<CuratedCategory, CuratedSet[]> = {
  botanical: BOTANICAL,
  fauna: FAUNA,
  landscape: LANDSCAPE,
}
