# ARCH.md — technical architecture of the rebuilt site

Companion to DESIGN.md (what) and STORYBOARD.md (videos). This file says how the page is built so every builder
agent writes compatible code. Golden rules from research/digests/CRITIC.md §5 apply everywhere.

## 1. Layout

```
index.html                 one page; import map; sections; video slots; JSON-LD; <noscript> posters
404.html, .nojekyll
assets/css/site.css        tokens + page + HUD (rewrite);  game.css (restyle, class contract kept)
assets/js/page.js          boot: tier gating, section observers, video observers, lazy import of the director
assets/js/engine/          boot.js (kept), cel.js, post.js, sky.js, materials.js, particles.js, ink.js (p5.brush overlay)
assets/js/director/        director.js (fixed canvas, camera rail, scene switching), rail.js (scroll → smoothed s)
assets/js/scenes/          one module per set: hangar.js, catapult.js, ops.js, armory.js, island.js (names per DESIGN.md)
assets/js/props/           mech.js, gantry.js, tunnel.js, ... procedural three.js geometry; exportable to the studio
assets/js/game3d/          unchanged logic; index.js build(r) and hud restyled
assets/video/              <clip>.mp4 + .webm + .jpg + README.md (which studio file made it)
studio/                    the offline video studio (never loaded by the site)
tools/qa/                  Playwright scripts (not deployed)
```

## 2. Runtime tiers (decided once in page.js, before any heavy import)

| tier | when | what |
|---|---|---|
| T0 static | `prefers-reduced-motion`, `saveData`, `probeGPU().software` (SwiftShader/llvmpipe) without `?force=1`, no WebGL2 | posters as section backgrounds, videos poster-only with a play button, no canvas, no ink overlay boil (one static stroke) |
| T1 lite | WebGL2 backend after `renderer.init()`, or `hardwareConcurrency ≤ 4`, or viewport ≤ 900 px, or first warm-up frame > 80 ms | fixed canvas, rail, cheap post (`quality:'cheap'`), particles halved, `maxDpr 1.5`, no reflector/godrays/afterimage |
| T2 full | WebGPU backend and none of the above | full anime post stack, compute-free particles at full count, `maxDpr 1.75` |

`?force=1` skips the software gate, `?webgl=1` forces the WebGL2 backend, `?tier=0|1|2` overrides (QA only).
Tier is exposed as `document.documentElement.dataset.tier` so CSS can adapt, and as `window.__site.tier`.

## 3. The director (one canvas, one renderer, one pipeline)

* `director.mount(canvas, { tier })` creates the renderer with `createRobustRenderer` (boot.js), builds every scene
  group up front (all lights added before the first frame), `compileAsync` + one hidden `pipeline.render()`, then
  fades the canvas in. Returns `{ pause(), resume(), dispose(), stats(), setSection(id, k) }`.
* Scenes are `Group`s with `visible` toggled; never rebuilt. Each scene module exports
  `build(ctx) → { group, update(t, dt, s), poses: { enter: {pos, look}, exit: {pos, look} }, hooks }` where `ctx =
  { THREE, renderer, tier, uniforms, materials }`. Shared materials come from `ctx.materials` (one CelNodeMaterial per
  colour role) so WebGL2 compiles a handful of programs.
* Camera rail: `rail.js` converts `scrollY` into a smoothed parameter `s ∈ [0, N]` (lerp toward the target at
  `1 - exp(-8 dt)`, dt clamped to 50 ms, updated inside the render tick, never in the scroll handler). Integer parts
  select the section, fractional parts drive the section's own camera keyframes (`kf`-style) between its `enter` and
  `exit` poses. Hard seams (cut / ink wipe) happen at fixed `s` values; the wipe covers the frame while `visible` flips.
* The render loop is `runLoop` from boot.js (IntersectionObserver + visibility + reduced-motion gating). While the
  game overlay is open the director is paused (`pause()`), and it is disposed after 5 minutes in the game.
* Post: `createAnimePipeline` from engine/post.js; the page drives `uniforms.impact/shake/aberration/speedLines/flash`
  from scene hooks (door opening, hover, launch). Impact frames hold ≤ 3 frames; ≤ 3 flashes per second.
* Device loss: `renderer.backend.device?.lost.then(...)` on WebGPU and `canvas 'webglcontextlost'` on WebGL2 → the
  director disposes and the page drops to T0 (posters), logging one console.warn. No reload loops.

## 4. Videos on the page

* Markup: `<video muted playsinline loop preload="metadata" poster="/assets/video/x.jpg" width height>` with
  `<source src=x.webm type="video/webm">` then `<source src=x.mp4 type="video/mp4">`. No `autoplay` attribute: an
  IntersectionObserver calls `play().catch(() => {})` when ≥ 50 % visible and `pause()` when hidden. T0 never plays
  automatically; a play button toggles.
* The opening clip plays once on first visit (sessionStorage flag) at T1/T2, can be skipped with Esc / click, and
  crossfades to the director whose camera starts at the storyboard's match-cut pose. On replays it is a play button.
* Size gate: `assets/video` ≤ 10 MB total; a clip ≤ 3.5 MB (mp4) — measured after the first encode and tuned with crf.

## 5. Live ink overlay (engine/ink.js, p5.brush standalone `brush.esm.js`)

* One fixed transparent canvas (960 × 540 logical, CSS-scaled), `pointer-events: none`, above the three.js canvas,
  below the HTML. Cleared and rendered only while an ink event is active. `scaleBrushes(3)` once before `add()`.
* Events (from DESIGN.md §3): title underline, section stamps, seam wipes, hover speed lines. Budgets per drawn frame:
  ≤ 40 strokes, 0 watercolour fills. 12 Hz boil via `brush.seed(1000 + floor(t*12))`. T0: one static frame.

## 6. HTML / CSS contract

* All CV facts are static HTML (verbatim from BRIEF.md); the page is complete and readable with JS disabled.
* Sections: `<section id data-scene="hangar" data-s="1">`; the director reads `data-s` boundaries from the DOM so the
  rail matches the layout at every viewport.
* HUD language lives in CSS tokens (`--cyan`, `--amber`, …) and a single inline SVG sprite for the few glyphs; no
  icon fonts; brand logos only from assets/logos.
* Accessibility: burger is a `<button aria-expanded>`; the game overlay is `role="dialog"` with `inert` on the page;
  focus returns to the launch button on close; every video has a text alternative; reduced-motion honoured.
* Fonts: Inter + JetBrains Mono (existing) + Bebas Neue + Anton (moved from studio/fonts to assets/fonts, OFL).

## 7. Game restyle contract

* `game3d/index.js build(r)` swaps materials to `CelNodeMaterial` + box hulls, the sky to `paintedSky`, water to toon
  water, post to the shared cheap pipeline (`lowfx` kept). No changes to modal.js, clock.js, combat.js, bosses.js,
  companion.js, progress.js, npcs.js logic (regression contract in repo-audit.md §2.4).
* Game HUD CSS re-skinned to the site HUD; class names unchanged.

## 8. QA contract (tools/qa, Playwright, both backends)

1. `?force=1&webgl=1` and `?force=1` (WebGPU on SwiftShader): zero console errors, zero three.js warnings, director
   mounted, screenshots at 1440 × 900 and 390 × 844 at s = each section.
2. Reduced motion and T0: finished-looking page from posters alone.
3. Videos: every `<video>` has both sources and a poster that exists; sizes within the gate.
4. Game: the four regression scenarios (modal pauses world, buddy follows/attacks, chamber sealed until 3 runes, no
   hits during dialog) via `window.__g`.
5. Keyboard: Tab order through nav, cards, launch button; Esc closes overlays.
6. Import check: every module import in assets/js resolves against the import map (`tools/qa/check-imports.mjs`).
