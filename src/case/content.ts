/**
 * The case-study narrative — the single source of the page copy. Sections render in order;
 * the figures are interleaved by id in CaseStudy.tsx. Kept here so the writing can be edited
 * without touching layout.
 */

export interface Section {
  /** a stable id so the page can interleave figures and anchor the nav. */
  id: string
  /** the small mono eyebrow. */
  eyebrow: string
  /** the section heading. */
  heading: string
  /** body paragraphs. */
  body: string[]
}

export const TITLE = {
  /** the big display line. */
  display: 'Making the grid visible.',
  /** the mono subtitle. */
  subtitle: 'Chickpea — a generative grid studio',
  /** a one-line stand-first under the title. */
  standfirst:
    'A tool that generates grids which are always mathematically correct — and that will draw you the math behind any one of them.',
  byline: 'Christopher Robin Fiore',
}

export const SECTIONS: Section[] = [
  {
    id: 'problem',
    eyebrow: 'The problem',
    heading: 'The grid is the one system designers never see.',
    body: [
      'Every page, poster, and screen sits on a grid — the proportions, the columns, the spacing that decide where everything lands. It is the most load-bearing decision in a layout and the most invisible. Designers internalize it; software hides it.',
      'Most grid tools draw faint guides and stop there. They give you the scaffolding but not the reasoning — never why this column, why that ratio. The system stays a black box, so it never teaches. You can use a grid your whole career and never be shown one.',
    ],
  },
  {
    id: 'idea',
    eyebrow: 'The idea',
    heading: 'A grid that is provably correct, and shows its work.',
    body: [
      'Chickpea generates compositions on grids that are always mathematically correct, from a library of strategies rooted in real mathematics — recursive subdivision, the golden section, classic Swiss modular lattices. Correct is not a claim here; it is enforced by tests that run on every grid.',
      'Then it does the thing other tools will not: it reveals its own skeleton. Ratios, modules, and spacing draw themselves as live dimension arrows, in the same visual language across every surface. A composition becomes a teaching object. The tool teaches the system it uses.',
    ],
  },
  {
    id: 'math',
    eyebrow: 'The math',
    heading: 'Three families, each provably correct.',
    body: [
      'The engine is a small set of pure functions — give one a seed and it returns a grid, the same grid, every time. Three families cover the territory between rational order and organic proportion. Each figure below is the real generator, running live; drag it.',
    ],
  },
  {
    id: 'bisection',
    eyebrow: 'Human intent in, math out',
    heading: 'Your rough cuts, perfected into infinite variations.',
    body: [
      'A grid from nothing is a starting point. A grid from your own image is a conversation. Drop a photograph and bisect it with quick, imprecise cuts — enter from the top edge for a vertical slice, from the side for a horizontal one, click to drop.',
      'Chickpea snaps those human cuts to the nearest ratio-correct anchors, then generates endlessly around them. Your composition stays yours; the math underneath it becomes flawless. Rough intent in, an infinite family of mathematically-perfect variations out.',
    ],
  },
  {
    id: 'craft',
    eyebrow: 'The craft',
    heading: 'Swiss-rational, but alive.',
    body: [
      'The landing hero is pixel-faithful to its Figma at rest — exact positions, exact tracking, the three palette colors — and renders fully without JavaScript. The truthful composition is always the fallback. Then a cursor layer brings it to life.',
      'Move across it and the nearest seam spring-separates, exposing a gap and measuring it with a dimension arrow. Springs, not eased curves, give the letters apparent mass — the quality that reads as alive rather than merely animated. The whole thing honors reduced-motion: the measurement still appears, the motion bows out.',
    ],
  },
  {
    id: 'engineering',
    eyebrow: 'The engineering',
    heading: 'Pure generators, enforced invariants, shareable seeds.',
    body: [
      'The grid math has no idea React exists. Every generator is a pure, seeded function with no UI imports, which makes it directly testable — and tested it is. An invariant suite checks that tiling generators cover the canvas with zero gaps and zero overlaps, that every guide and module stays in bounds, that modular edges align to the lattice, and that each ratio label matches the proportion it measured.',
      'Determinism is also the sharing mechanism: a seed in the URL is a reproducible composition, and the figures on this page are built out of the same engine the studio ships — live, not screenshots. Design, grid math, interaction, tests, and deploy: one person, end to end, in React and TypeScript.',
    ],
  },
  {
    id: 'close',
    eyebrow: 'See it run',
    heading: 'Open the studio, or watch the hero come apart.',
    body: [
      'The case for a grid you can see the math behind is best made by using one. Generate from scratch, bisect an image, toggle the reveal, export the result — or go back to the hero and move your cursor across the title.',
    ],
  },
]
