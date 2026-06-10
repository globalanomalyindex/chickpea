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
      'every hard question in this studio has a much older answer. what makes a set of colors feel like they belong together? how do you fill a space so it reads as composed rather than arbitrary? petals, plumage, leaf venation, the spiral of a sunflower head: living things settled these millions of years before a design tool existed. and underneath all of them sits the same accounting: nature treats energy as something to be earned, not spent, so every pattern that survives is paying its way. the work was to stop inventing rules and start borrowing the ones that already hold.',
      'so chickpea is not a folder of presets. it is two generative engines, each grounded in a natural principle, each wrapped in math strict enough that a broken result is impossible, and judged against a quality bar high enough that a boring one almost never ships. a chickpea is round, plain, and quietly well-structured. felt like the right mascot for a grid.',
    ],
  },
  {
    id: 'color',
    eyebrow: 'the color engine',
    heading: 'color in the space the eye actually uses.',
    body: [
      'color is not red-green-blue. the eye does not see in channels; it reads lightness, chroma, and hue, and it spaces them perceptually. so the engine lives in oklch, a perceptual color space where an equal step looks like an equal step, and it never lets a color leave the screen’s gamut by clipping a channel, which silently drags hue and lightness with it. it walks chroma down to the boundary instead, the way a real pigment desaturates rather than turning a different color.',
      'hue is drawn from a weighted mixture of von mises distributions, the circular cousin of the bell curve and the honest tool for a quantity that lives on a wheel. the weights give a palette the 60-30-10 structure designers reach for: a dominant family with counterpoints, not equal slices. a couple of tight clusters give a monochrome; two opposite ones, a complementary; loosen them and you get the easy disorder of a wildflower verge. and sometimes hue travels with lightness the way nature grades it, pale gold down through orange into deep violet: the sunset is a genre here, sampled like any other. a shared cast can tint every color the way one light source would, which is the old painters’ trick for making a palette feel like a single place.',
      'every color is also held to its hue’s natural lightness, the level where that hue can carry the most chroma. yellow lives light and blue lives deep, in paint and in gamut alike, and a yellow dragged into the dark reads as mud. the scorer knows this, and it judges vividness against each color’s own ceiling rather than in absolute terms, because the absolute scale quietly favors the corner of the gamut where magenta lives. measured before the fix, 86 percent of lead colors came out purple. after it, a saturated gold or a deep teal can lead a palette as often as it deserves to.',
      'the rarest statement is also the quietest: a field of designed neutrals, charcoal through cream under one shared cast, carrying a single saturated signal. the cardinal against snow; one poppy on a chalk down. nature prices color exactly this way, because pigment costs energy: most of any honest scene is inexpensive quiet, and saturation is spent only where it earns its keep. nothing here is a preset, and no genre is stamped in; these palettes emerge from the same continuous axes as everything else when the dice land in that corner. the judge just knows the measurable difference between a designed field and gray padding: a field is a wide, evenly-stepped lightness ladder wearing one coherent tint, and padding is a clump. the first earns its place. the second is executed.',
      'nothing is stored. every palette is sampled, scored on nine perceptual measures with hard gates for the failures that should disqualify (near-duplicates, gray padding, black-reading chips), and only the best of a whole population is shown, so "always beautiful" is a property of the output, not a wish about the average draw.',
    ],
  },
  {
    id: 'grid',
    eyebrow: 'the grid engine',
    heading: 'a grid that cannot be wrong, because of how it is grown.',
    body: [
      'a leaf does not lay out a grid and then check it for gaps; it divides, and division cannot leave a gap. the grid engine grows the same way. it only ever cuts an existing rectangle the whole way across, so every composition is a perfect tiling: zero gaps, zero overlaps, every shared edge exact, not because a test happened to pass but because no other outcome is reachable. correctness is structural here, the way it is in a honeycomb.',
      'the cuts land on the proportions nature and craft keep reusing: halves, thirds, the golden section that sets the seed spiral of a sunflower, and the silver section of classical japanese carpentry. and beyond free growth, the engine knows the cut programs randomness can never wander into. it can whirl: the spiral of the nautilus, each turn slicing a slab and rotating a quarter, tightening into an eye. it can mirror: everything built so far compressed into one half and reflected exactly, the bilateral symmetry of nearly everything that walks. it can echo: the same split repeated inside itself at falling scales, the way a fern frond repeats its own outline.',
      'here is the part borrowed straight from developmental biology: a composition is not one construction but an ordered PROGRAM of them, one to four stages run in sequence, the way a body plan is a sequence of developmental stages. and order matters. spiral then mirror is a double whirl; mirror then spiral is a symmetric creature with one wild limb that breaks the symmetry. mutation does not just drift the numbers, it can reorder, drop, or append stages, which is what biologists call heterochrony when evolution does it to embryos. the key beside every composition names the program it ran ("lattice → echo → mirror" reads like a recipe because it is one). each coordinated stage stays a deliberate minority; when the spiral first learned to win it took a third of all seeds, and the cure, as ever, was measuring and rebalancing until every style could win on merit.',
      'the same quality search as the color engine sifts a population of candidates and emits the one that reads as designed. three dials (complexity, tension, rhythm) lean the search without ever breaking it; everything else is the seed. flip on reveal-math and a composition will export its own skeleton as a transparent png, lines always, annotations optional.',
      'the image studio runs on the same canon. drop a picture, make a few rough cuts, and each one snaps to the nearest true proportion, of the whole canvas or of the region between your earlier cuts, so a second slice can honestly be "the golden point of the right half". the interiors of every seed variation are then grown and scored like everything else. your intent stays anchored; the rest is searched, never settled for.',
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
      'every generator is a pure, seeded function that has never heard of react. give it a seed and a few dials and it returns the same composition forever. that purity is what makes it testable, and tested it is: an invariant suite proves the tiling covers the canvas with zero gaps, that every guide sits bit-exactly on a module edge, that a mirrored grid reflects exactly, that each ratio label matches the proportion it measured. over two hundred tests guard it, and the figures on this page are the real engine running live, not screenshots; a seed in the url is a reproducible composition you can share.',
      'the design and the engineering are one job here: perceptual color theory, circular statistics, computational geometry, interaction craft, and the test suite that keeps them honest, one person end to end in react and typescript. the genuinely hard calls (which scoring terms to trust, how to stop the search collapsing onto a single safe grid) were not reasoned out in the abstract. they were made by building it, measuring five hundred seeds at a time, and setting adversarial reviewers loose on the scorers to construct ugly things that score well, then closing every exploit they could reproduce. the data won every argument with the theory.',
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
