# Learning Loops

Looping scenes that teach one programming concept at a time, under the rules of several languages. Each scene is a marble run: marbles are units of work, track sections are states, and toggling a runtime morphs the track on the same timeline without resetting.

The site is Astro with the Starlight docs theme. Scenes are framework-free web components driven by a JSON manifest.

## Layout

```
scenes/<slug>/manifest.json   what the scene is: skeleton, variants, vocabulary, glossary, expected beat tables
scenes/<slug>/sim.js          the state machine, no drawing
scenes/<slug>/render.js       the renderer, registers itself for <loop-scene data-scene="slug">
scenes/_shared/               the element, the design tokens, shared CSS
src/content/docs/<topic>/     one MDX page per scene, prose around <LoopScene scene="slug" />
src/components/               LoopScene and VariantTable, both read the manifest
tools/                        validators and the screenshot helper
notes/                        the planning documents this grew from
```

## Commands

With [just](https://github.com/casey/just) installed, `just` lists the recipes. These are the npm scripts underneath.

```
npm run dev            local site
npm test               level 1: every scene's state machine against its manifest's beat tables
npm run build          static site into dist/
npm run validate:dom   level 2: render each scene and runtime in headless Chrome and diff the trace strip
npm run validate       all of the above
npm run shot -- giving-up-control go 5    screenshot a scene at a tick
npm run lint           prose lint of pages, manifests, and this file with the sentences de-stink rules
```

Level 2 and the screenshot helper use the installed Google Chrome on macOS; set CHROME to point elsewhere.

## Adding a runtime to a scene

Add an entry under `variants` in the manifest, list it in `variantOrder`, and give it the same fields as its neighbours. No code changes.

## Adding a scene

Copy a scene directory, write its manifest and beat tables first, then its state machine, then its renderer. Register the renderer in `scenes/index.js`, add an MDX page under the topic, and run `npm run validate`.

## Publishing

Pushing to `main` runs `.github/workflows/deploy.yml`: tests, build, rendered validation in the runner's Chrome, then deploy to GitHub Pages. The site lives at https://lex00.github.io/learning-loops/.
