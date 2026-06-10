/**
 * The case-study narrative: the single source of the page copy. Sections render in order; figures
 * are interleaved by id in CaseStudy.tsx. Kept here so the writing can be edited without touching
 * layout. Lowercase throughout (the wordmark "Chickpea" and the rainbow name are the exceptions,
 * rendered in CaseStudy.tsx). No em-dashes in the prose.
 *
 * Inline markup (see prose.tsx): {{word}} paints a natural noun in the colors of the thing it names,
 * {{display|ramp}} overrides the ramp key, and [[ref-id]] is a superscript citation into REFERENCES.
 */

export interface Section {
  /** a stable id so the page can interleave figures and anchor the nav. */
  id: string
  /** the small mono eyebrow. */
  eyebrow: string
  /** the section heading. */
  heading: string
  /** body paragraphs (may contain {{tint}} and [[cite]] markup). */
  body: string[]
}

/** One reference. `id` is what the prose cites with [[id]]; the list order sets the printed number. */
export interface Reference {
  id: string
  title: string
  detail: string
}

export const TITLE = {
  /** the big display line. */
  display: 'grown, not drawn',
  /** the mono subtitle. */
  subtitle: 'chickpea · a generative grid + color studio',
  /** a one-line stand-first under the title. */
  standfirst:
    'two engines that make endless, never-repeating compositions which are always mathematically perfect and always look good, then draw you the math behind any one of them. built by noticing that nature had already done the homework.',
  /** rendered as a per-letter rainbow in CaseStudy.tsx. */
  byline: 'christopher robin fiore',
}

export const SECTIONS: Section[] = [
  {
    id: 'thesis',
    eyebrow: 'the thesis',
    heading: 'nature already solved color and structure, so i asked it how',
    body: [
      'every hard question in this studio has a much older answer. what makes a set of colors feel like they belong together? how do you fill a space so it reads as composed rather than arbitrary? {{petals}}, {{plumage}}, {{leaf venation}}, the spiral of a {{sunflower}} head: living things settled these millions of years before a design tool existed, and they did not have a moodboard. underneath all of them sits the same accounting: nature treats energy as something to be earned, not spent, so every pattern that survives is paying its way.[[economy]] the job was to stop inventing rules and start borrowing the ones that already hold.',
      'so chickpea is not a folder of presets. it is two generative engines, each grounded in a natural principle, each wrapped in math strict enough that a broken result is impossible, and judged against a quality bar high enough that a boring one almost never ships. a chickpea is round, plain, and quietly well-structured. felt like the right mascot for a grid, and the name was available.',
    ],
  },
  {
    id: 'color',
    eyebrow: 'the color engine',
    heading: 'color in the space the eye actually uses',
    body: [
      'color is not red-green-blue. the eye does not see in channels; it reads lightness, chroma, and hue, and it spaces them perceptually. so the engine lives in oklch,[[oklch]] a perceptual color space where an equal step looks like an equal step, and it never lets a color leave the screen’s gamut by clipping a channel, which silently drags hue and lightness with it. it walks chroma down to the boundary instead, the way a real pigment desaturates rather than turning a different color.',
      'hue is drawn from a weighted mixture of von mises distributions,[[vonmises]] the circular cousin of the bell curve and the honest tool for a quantity that lives on a wheel. the weights give a palette the 60-30-10 structure designers reach for: a dominant family with counterpoints, not equal slices. a couple of tight clusters give a monochrome; two opposite ones, a complementary; loosen them and you get the easy disorder of a {{wildflower}} verge. and sometimes hue travels with lightness the way nature grades it, pale gold down through orange into deep violet: the sunset is a genre here, sampled like any other. a shared cast can tint every color the way one light source would, which is the old painters’ trick for making a palette feel like a single place.',
      'every color is also held to its hue’s natural lightness, the level where that hue can carry the most chroma. yellow lives light and blue lives deep, in paint and in gamut alike, and a yellow dragged into the dark reads as mud. the scorer judges vividness against each color’s own ceiling rather than in absolute terms, because the absolute scale quietly favors the corner of the gamut where magenta lives. i learned this the embarrassing way: measured before the fix, 86 percent of lead colors came out purple. i had a type, and the type was magenta. judging vividness relative to each hue dropped that to 36, and now a saturated gold or a deep teal leads a palette as often as it earns to.[[herocensus]]',
      'the rarest statement is also the quietest: a field of designed {{neutrals}}, {{charcoal}} through {{cream}} under one shared cast, carrying a single saturated signal. the {{cardinal}} against {{snow}}; one {{poppy}} on a chalk down. nature prices color exactly this way, because pigment costs energy: most of any honest scene is inexpensive quiet, and saturation is spent only where it earns its keep.[[figureground]] nothing here is a preset, and no genre is stamped in; these palettes emerge from the same continuous axes as everything else when the dice land in that corner. the judge just knows the measurable difference between a designed field and gray padding: a field is a wide, evenly-stepped lightness ladder wearing one coherent tint, and padding is a clump. one earns its place; the other gets shown the door.',
      'nothing is stored. every palette is sampled, scored on nine perceptual measures with hard gates for the failures that should be disqualifying on sight (near-duplicates, gray padding, chips that render as black), and only the best of a whole population survives, so "always beautiful" is a property of the output rather than a wish about the average draw.',
    ],
  },
  {
    id: 'grid',
    eyebrow: 'the grid engine',
    heading: 'a grid that cannot be wrong, because of how it grows',
    body: [
      'a {{leaf}} does not lay out a grid and then check it for gaps; it divides, and division cannot leave a gap. the grid engine grows the same way. it only ever cuts an existing rectangle the whole way across, a guillotine partition,[[guillotine]] so every composition is a perfect tiling: zero gaps, zero overlaps, every shared edge exact, not because a test happened to pass but because no other outcome is reachable. correctness is structural here, the way it is in a {{honeycomb}}.',
      'the cuts land on the proportions nature and craft keep reusing: halves, thirds, the golden section that sets the seed spiral of a {{sunflower}},[[phi]] and the metallic means beyond it, silver and bronze, the same self-similar recipe at different weights.[[metallic]] the silver one has a better name worth saying in full: {{白銀比|hakugin}}, hakugin-hi, the white-silver ratio of 1 to √2, the proportion that sizes japanese temple bays and buddhist statuary and, lately, the two observatory decks of the tokyo skytree.[[hakugin]] beyond free growth, the engine knows the cut programs randomness can never wander into. it can whirl: the spiral of the {{nautilus}}, each turn slicing a slab and rotating a quarter, tightening into an eye. it can mirror: everything built so far compressed into one half and reflected exactly, the bilateral symmetry of nearly everything that walks. it can echo: the same split repeated inside itself at falling scales, the way a {{fern}} frond repeats its own outline.',
      'here is the part lifted straight from developmental biology: a composition is not one construction but an ordered program of them, one to four stages run in sequence, the way a body plan is a sequence of developmental stages. and order matters. spiral then mirror is a double whirl; mirror then spiral is a symmetric creature with one wild limb that breaks the symmetry. mutation does not just nudge the numbers, it can reorder, drop, or append stages, which is what biologists call heterochrony when evolution does it to an embryo and what i call tuesday when i do it to a rectangle.[[heterochrony]] the key beside every composition names the program it ran, and "lattice → echo → mirror" reads like a recipe because it is one. each coordinated stage stays a deliberate minority; when the spiral first learned to win it took a third of all seeds, the generative equivalent of one kid hogging the ball, and the cure was measuring and rebalancing until every style could win on merit.',
      'the same quality search as the color engine sifts a population of candidates and emits the one that reads as designed. three dials (complexity, tension, rhythm) lean the search without ever breaking it; everything else is the seed, and a seed is any text you like, a number, a word, a whole phrase, your cat’s name, hashed to a starting point the way a world seed works in minecraft.[[fnv]] flip on reveal-math and a composition exports its own skeleton as a transparent png, lines always, annotations optional.',
      'the image studio runs on the same canon. drop a picture, make a few rough cuts, and each one snaps to the nearest true proportion, of the whole canvas or of the region between your earlier cuts, so a second slice can honestly be "the golden point of the right half". the colors are read out of the image by k-means++ in the same perceptual space,[[kmeanspp]] so even a small but vivid feature gets its own swatch instead of dissolving into the background. your intent stays anchored; the rest is searched, never settled for.',
    ],
  },
  {
    id: 'reveal',
    eyebrow: 'the product idea',
    heading: 'a tool that teaches the system it is using',
    body: [
      'the grid is the most load-bearing decision in any layout and the most invisible: internalized by designers, hidden by software. most tools draw a few faint guides and stop, handing you scaffolding but never the reasoning. chickpea does the thing they will not. it reveals its own skeleton: ratios, modules, and spacing draw themselves as live dimension arrows, truthfully labelled, so a golden cut reads "1/φ" and never a rounded decimal that lies about what it is. the composition becomes a thing you can learn from, not just look at. it is the design tool i wanted when i was learning, narrating its own decisions instead of making me guess them.',
    ],
  },
  {
    id: 'craft',
    eyebrow: 'the craft',
    heading: 'swiss-rational at rest, alive the second you touch it',
    body: [
      'the landing is pixel-faithful to its figma at rest and renders completely without javascript: the truthful, static composition is always the fallback. then a cursor layer brings it to life. move across the title and the nearest seam spring-separates, opening a gap and measuring it. springs, not eased curves, give the letters apparent mass, which is the small thing that reads as alive rather than merely animated. honor reduced-motion and the measurement still appears; only the movement bows out, because a nice effect is never worth making someone queasy.',
    ],
  },
  {
    id: 'engineering',
    eyebrow: 'the engineering',
    heading: 'pure functions, hard invariants, a url you can share',
    body: [
      'every generator is a pure, seeded function that has never heard of react. give it a seed and a few dials and it returns the same composition forever. that purity is what makes it testable, and tested it is: an invariant suite proves the tiling covers the canvas with zero gaps, that every guide sits bit-exactly on a module edge, that a mirrored grid reflects exactly, that each ratio label matches the proportion it measured. the numbers further down are that suite and the measurement harness, not marketing; the figures on this page are the real engine running live, not screenshots; a seed in the url is a reproducible composition you can hand to anyone.',
      'the design and the engineering are one job here: perceptual color theory, circular statistics, computational geometry, interaction craft, and the test suite that keeps them honest, one person end to end in react and typescript. the genuinely hard calls (which scoring terms to trust, how to stop the search collapsing onto a single safe grid) were not reasoned out in the abstract. they were made by building it, measuring five hundred seeds at a time, and setting adversarial reviewers loose on the scorers to build ugly things that score well, then closing every exploit they could reproduce. the data won every argument it had with my taste, which is the whole point of collecting it.',
    ],
  },
  {
    id: 'close',
    eyebrow: 'see it run',
    heading: 'open the studio, break the hero, read the math',
    body: [
      'the case for a system you can see the math behind is best made by using one. generate from scratch, drag the dials, toggle the reveal, export a transparent skeleton, or go back to the hero and pull the title apart with your cursor. it does not break. i checked five hundred times.',
    ],
  },
]

/**
 * Works and ideas the prose cites by [[id]]. Order here is the printed footnote number; REF_INDEX
 * maps each id to that number for the superscripts.
 */
export const REFERENCES: Reference[] = [
  { id: 'economy', title: 'optimal foraging and the economy of nature', detail: 'macarthur & pianka, "on optimal use of a patchy environment", the american naturalist (1966); the broader rule that a metabolically expensive trait is selected against unless it returns more than it costs, so the patterns that persist are the ones paying their way.' },
  { id: 'oklch', title: 'the oklab / oklch perceptual color space', detail: 'björn ottosson, "a perceptual color space for image processing" (2020). equal numeric steps read as equal perceptual steps; the engine reasons here and gamut-maps to srgb only at the very end.' },
  { id: 'vonmises', title: 'the von mises distribution', detail: 'richard von mises (1918); the circular analogue of the gaussian from directional statistics (mardia & jupp, "directional statistics"). the honest way to sample a quantity, hue, that lives on a wheel rather than a line.' },
  { id: 'herocensus', title: 'hero-hue census, 500 seeds (this project)', detail: 'my own measurement: scoring vividness on absolute chroma sent 86% of lead colors into magenta and violet, the deepest-gamut corner. scoring it relative to each hue\'s own ceiling dropped that to 36% and let gold, red, green and teal lead. the number is generated, not asserted; see "the work".' },
  { id: 'figureground', title: 'figure-ground, and the cost of a saturated signal', detail: 'edgar rubin, "synsoplevede figurer" (1915), the figure-ground demonstration. the cost side: amotz zahavi\'s handicap principle (1975), and the fact that carotenoid pigment is diet-limited and traded against immune function, which is exactly why a vivid signal is spent sparingly against a quiet field.' },
  { id: 'guillotine', title: 'guillotine partitions', detail: 'the recursive subdivision in which every cut crosses a rectangle edge-to-edge, standard in cutting-stock and computational geometry. the zero-gap, zero-overlap tiling is closed under the operation, so correctness is structural rather than checked after the fact.' },
  { id: 'phi', title: 'the golden ratio in phyllotaxis', detail: 'h. vogel, "a better way to construct the sunflower head", mathematical biosciences (1979); douady & couder (1992) on the golden angle. φ = (1+√5)/2 sets the parastichies of the sunflower and pinecone, the densest non-repeating seed packing.' },
  { id: 'metallic', title: 'the metallic means family', detail: 'vera w. de spinadel, "the metallic means family and forbidden symmetries" (1999). the family xₙ = n + 1/xₙ: gold (n=1), silver (n=2), bronze (n=3); each is the self-similar proportion at a different weight, and all three are cut-ratio voices in the engine.' },
  { id: 'hakugin', title: '白銀比 (hakugin-hi), the white-silver ratio', detail: 'the proportion 1:√2 (≈1:1.414), the silver rectangle, also called yamato-hi. the basis of japanese temple carpentry (kiwari), buddhist statuary, and iso paper sizes; the tokyo skytree sets its two observatory decks in this ratio.' },
  { id: 'heterochrony', title: 'heterochrony', detail: 'evolutionary change in the timing and ordering of developmental programs; the term is haeckel\'s, the modern treatment is stephen jay gould, "ontogeny and phylogeny" (1977). the grid mutates by reordering, dropping, and appending its build stages.' },
  { id: 'fnv', title: 'the fnv-1a hash', detail: 'glenn fowler, landon curt noll, and kiem-phong vo. a fast non-cryptographic hash mapping an arbitrary seed string to a uint32, so a word or phrase becomes a reproducible starting point the way a world seed does in minecraft.' },
  { id: 'kmeanspp', title: 'k-means++ seeding', detail: 'david arthur & sergei vassilvitskii, "k-means++: the advantages of careful seeding", soda (2007): distance-squared-weighted initialization. run in oklab, it pulls a small but vivid image region into its own cluster instead of losing it to the dominant mass.' },
]

export const REF_INDEX: Record<string, number> = Object.fromEntries(
  REFERENCES.map((r, i) => [r.id, i + 1]),
)
