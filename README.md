# Chickpea

a generative grid + color studio that draws you the math behind any composition.

grids are the invisible scaffolding of design: the system every poster, page, and screen sits on, and the one thing most tools take pains to hide. Chickpea does the opposite. it makes compositions that are always mathematically perfect and always look good, and it will draw you its own skeleton on demand, the ratios and modules and spacing rendered as live dimension arrows. a composition becomes a thing you can learn from, not just look at.

built by looking at how nature already solved the same problems: how the eye reads color, and how living things divide space.

**live:** https://globalanomalyindex.github.io/chickpea/

three surfaces: `/` the alive hero · `/studio` the generator · `/case` the case study.

## what it does

- **two generative engines, no presets.** color is sampled in oklch, the perceptual space the eye actually uses, from a von mises hue mixture on the color wheel; grids grow as guillotine slice-trees where a perfect tiling is structural, not checked after the fact. both are quality-scored across many candidates, so every output is selected for beauty rather than hoped for.
- **infinite variety, always correct.** never-repeating compositions of varying density, style, and aspect ratio, every one a zero-gap tiling. three dials (complexity, tension, rhythm) bias the engine; the seed re-rolls within it.
- **reveal the math.** a toggle overlays guides, module dimensions, and truthful ratio labels (a golden cut reads "1/φ", never a rounded decimal), and exports the skeleton as a true transparent png with alpha, lines always, annotations optional.
- **image bisection.** drop an image, make rough cuts; Chickpea snaps them to ratio-correct anchors and generates endless variations that keep your image's aspect and intent.
- **an alive hero.** a swiss-rational landing, pixel-faithful at rest, that comes apart under the cursor: the nearest seam spring-separates and a dimension arrow measures the gap it opened. honors reduced-motion.
- **shareable seeds.** every composition lives in a reproducible url.

## stack

react, typescript, vite, react-router, motion, vitest. svg render and export, no webgl, no icon library, every mark is inline hairline svg. static build, deployed to github pages by actions on every push.

## run it

```bash
npm install
npm run dev        # local dev server
```

```bash
npm run typecheck  # tsc
npm test           # vitest: ~200 unit + invariant tests
npm run build      # production build to dist/
npm run preview    # serve the production build
```

## why it's built this way

the core is a set of pure, seeded functions, `(seed, dials) => grid` and a palette twin, with no react anywhere near them. that buys two things a portfolio piece should prove rather than claim:

- **correctness is structural, not asserted.** a grid only ever cuts a rectangle the whole way across, so a perfect tiling is the only reachable outcome; an invariant suite still checks zero gaps, zero overlaps, in-bounds, and that every guide sits bit-exactly on a module edge. "always mathematically perfect" is a test, not a tagline.
- **determinism is the sharing mechanism.** the same `(seed, dials)` always yields the same composition, so a url is reproducible and the case-study figures are the real engine running live, not screenshots.

the hard calls (which scoring terms to trust, how to keep variety from collapsing onto one safe grid) were made by building it, measuring 500 seeds at a time, and trusting the data over the theory.

---

built end to end (design, grid + color math, interaction, tests, deploy) by [globalanomalyindex](https://github.com/globalanomalyindex).

christopher robin fiore  
design engineer, creative technologist, luckiest boyfriend in the world :>
