/**
 * The case-study narrative: the single source of the page copy. Sections render in order; figures
 * are interleaved by id in CaseStudy.tsx. Kept here so the writing can be edited without touching
 * layout. Lowercase throughout (the wordmark "Chickpea" and the rainbow name are the exceptions,
 * rendered in CaseStudy.tsx). No em-dashes in the prose.
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
  display: 'grown, not drawn.',
  /** the mono subtitle. */
  subtitle: 'chickpea · a generative grid + color studio',
  /** a one-line stand-first under the title. */
  standfirst:
    'two engines that make endless, never-repeating compositions which are always mathematically perfect and always look good, then draw you the math behind any one of them. built by noticing that nature had already solved the same problems.',
  /** rendered as a per-letter rainbow in CaseStudy.tsx. */
  byline: 'christopher robin fiore',
}

export const SECTIONS: Section[] = [
  {
    id: 'thesis',
    eyebrow: 'the thesis',
    heading: 'nature solved color and structure first. so the move was to ask it.',
    body: [
      'every hard question in this studio has a much older answer. what makes a set of colors feel like they belong together? how do you fill a space so it reads as composed rather than arbitrary? petals, plumage, leaf venation, the spiral of a sunflower head: living things settled these millions of years before a design tool existed. the work was to stop inventing rules and start borrowing the ones that already hold.',
      'so chickpea is not a folder of presets. it is two generative engines, each grounded in a natural principle, each wrapped in math strict enough that a broken result is impossible, and judged against a quality bar high enough that a boring one almost never ships. a chickpea is round, plain, and quietly well-structured. felt like the right mascot for a grid.',
    ],
  },
  {
    id: 'color',
    eyebrow: 'the color engine',
    heading: 'color in the space the eye actually uses.',
    body: [
      'color is not red-green-blue. the eye does not see in channels; it reads lightness, chroma, and hue, and it spaces them perceptually. so the engine lives in oklch, a perceptual color space where an equal step looks like an equal step, and it never lets a color leave the screen’s gamut by clipping a channel, which silently drags hue and lightness with it. it walks chroma down to the boundary instead, the way a real pigment desaturates rather than turning a different color.',
      'hue is drawn from a mixture of von mises distributions, the circular cousin of the bell curve and the honest tool for a quantity that lives on a wheel. a couple of tight clusters give a monochrome; two opposite ones, a complementary; loosen them and you get the easy disorder of a wildflower verge. nothing is stored. every palette is sampled, scored on eight perceptual measures, and only the best of a whole population is shown, so "always beautiful" is a property of the output, not a wish about the average draw.',
    ],
  },
  {
    id: 'grid',
    eyebrow: 'the grid engine',
    heading: 'a grid that cannot be wrong, because of how it is grown.',
    body: [
      'a leaf does not lay out a grid and then check it for gaps; it divides, and division cannot leave a gap. the grid engine grows the same way. it only ever cuts an existing rectangle the whole way across, so every composition is a perfect tiling: zero gaps, zero overlaps, every shared edge exact, not because a test happened to pass but because no other outcome is reachable. correctness is structural here, the way it is in a honeycomb.',
      'the cuts land on the proportions nature keeps reusing: halves, thirds, the golden section that sets the turn of a pine cone and the seed spiral of that sunflower. then the same quality search as the color engine sifts a population of candidates and emits the one that reads as designed. three dials (complexity, tension, rhythm) lean the search without ever breaking it; everything else is the seed. flip on reveal-math and a composition will export its own skeleton as a transparent png, lines always, annotations optional.',
    ],
  },
  {
    id: 'reveal',
    eyebrow: 'the product idea',
    heading: 'a tool that teaches the system it is using.',
    body: [
      'the grid is the most load-bearing decision in any layout and the most invisible: internalized by designers, hidden by software. most tools draw a few faint guides and stop, handing you scaffolding but never the reasoning. chickpea does the thing they will not. it reveals its own skeleton: ratios, modules, and spacing draw themselves as live dimension arrows, truthfully labelled, so a golden cut reads "1/φ" and never a rounded decimal that lies about what it is. the composition becomes a thing you can learn from, not just look at.',
    ],
  },
  {
    id: 'craft',
    eyebrow: 'the craft',
    heading: 'swiss-rational at rest, alive on contact.',
    body: [
      'the landing is pixel-faithful to its figma at rest and renders completely without javascript: the truthful, static composition is always the fallback. then a cursor layer brings it to life. move across the title and the nearest seam spring-separates, opening a gap and measuring it. springs, not eased curves, give the letters apparent mass, which is the small thing that reads as alive rather than merely animated. honor reduced-motion and the measurement still appears; only the movement bows out.',
    ],
  },
  {
    id: 'engineering',
    eyebrow: 'the engineering',
    heading: 'pure functions, enforced invariants, shareable seeds.',
    body: [
      'every generator is a pure, seeded function that has never heard of react. give it a seed and a few dials and it returns the same composition forever. that purity is what makes it testable, and tested it is: an invariant suite proves the tiling covers the canvas with zero gaps, that every guide sits bit-exactly on a module edge, that each ratio label matches the proportion it measured. around two hundred tests guard it, and the figures on this page are the real engine running live, not screenshots; a seed in the url is a reproducible composition you can share.',
      'the design and the engineering are one job here: perceptual color theory, circular statistics, computational geometry, interaction craft, and the test suite that keeps them honest, one person end to end in react and typescript. the genuinely hard calls (which scoring terms to trust, how to stop the search collapsing onto a single safe grid) were not reasoned out in the abstract. they were made by building it, measuring five hundred seeds at a time, and believing the data over the theory when the two disagreed.',
    ],
  },
  {
    id: 'close',
    eyebrow: 'see it run',
    heading: 'open the studio. break the hero. read the math.',
    body: [
      'the case for a system you can see the math behind is best made by using one. generate from scratch, drag the dials, toggle the reveal, export a transparent skeleton, or go back to the hero and pull the title apart with your cursor.',
    ],
  },
]
