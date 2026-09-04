# Learning Loops. `just` lists these.

set shell := ["zsh", "-cu"]

default:
    @just --list

# local site with live reload
dev:
    npm run dev

# level 1: every scene's state machine against its manifest's beat tables
test:
    npm test

# prose lint with the sentences de-stink rules (just lint --min=low for everything)
lint *args:
    node tools/lint-prose.mjs {{args}}

# static site into dist/
build:
    npm run build

# level 2: render each scene and runtime in headless Chrome and diff the trace strip (needs dist/)
validate-dom:
    npm run validate:dom

# everything: tests, build, rendered validation
validate:
    npm run validate

# screenshot a scene at a tick: just shot waiting-on-io go 5
shot slug="waiting-on-io" variant="asyncio" tick="5":
    npm run shot -- {{slug}} {{variant}} {{tick}}

# serve the built site the way Pages will, under the base path
preview:
    npm run preview

# remove build output
clean:
    rm -rf dist .astro
