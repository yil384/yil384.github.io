# yil384.github.io

Personal homepage of Yichen Lin (Ph.D. student, UC San Diego CSE).

Plain HTML/CSS and native ES modules, no build step. The page is a short film and a set of live scenes: an opening film ("Sortie"),
three more clips, and a fixed three.js layer (r186, WebGPU with a WebGL2 fallback) that flies a camera through a hangar and over an
island as you scroll. The island is also a small playable game. Devices without a usable GPU, reduced motion, and no-JS visitors get
the same page from posters; every fact is static HTML.

```
index.html                 the page (seven stations), import map, JSON-LD
assets/css/site.css        design system + page;  game.css: the island overlay (re-skinned, class names unchanged)
assets/js/page.js          tier gating (T0 poster / T1 lite / T2 full), opening film, video controller, director + game seams
assets/js/director/        the live layer: one canvas, one renderer, scroll rail, hangar/island switch
assets/js/scenes/          hangar.js, island.js
assets/js/props/           props.json (baked from the studio) + loader that rebuilds the joint hierarchy in three.js
assets/js/engine/          cel shading, anime post stack, painted sky, materials, particles
assets/js/three/, game3d/  renderer bootstrap; the island game (logic untouched by the re-skin)
assets/video/              the four clips (MP4 + poster JPG), made by the studio
studio/                    offline video studio (p5.js + p5.brush in headless Chromium, ffmpeg): see studio/README.md
tools/qa/                  Playwright checks (site, WebGPU page, director stations, game smoke, import map); tools/export-props.mjs
lab/                       engine / director / game test pages (noindex)
docs/                      DESIGN.md (intent), STORYBOARD.md, ARCH.md, REVIEW.md (what is verified and what is not)
```

Run locally with any static server, e.g. `python3 -m http.server 8000`. Query overrides for QA: `?force=1` (skip the software-GPU gate),
`?webgl=1` (force WebGL2), `?tier=0|1|2`, `?play=1` (open the island).

Checks (need Playwright and Chromium; see docs/REVIEW.md for sandbox notes):
`node tools/qa/site-check.mjs`, `node tools/qa/site-gpu.mjs`, `node tools/qa/game-check.mjs [--webgpu]`,
`node tools/qa/director-shots.mjs [--webgpu]`, `node tools/qa/check-imports.mjs`.

Logos belong to their organisations. Icons: Simple Icons (CC0), Lucide (ISC), game-icons.net (CC BY 3.0). Studio engine ported from
ClaudeAnimationBase (MIT); fonts from Fontsource (OFL).
