# Handoff: yil384.github.io "most fun academic homepage"

Last updated 2026-09-30 (round 5: phones + Hub 2.0 merged). Read this first, then `CLAUDE.md` (repo root), `docs/dev/GAME_SPEC.md` and `docs/dev/REGIONS_API.md`.

## What this is
Yichen Lin's homepage (UCSD CSE Ph.D. student). Vanilla HTML/CSS/ES modules, no build step, no CDNs; three.js r186
(WebGPU with WebGL2 fallback, TSL) self-hosted in `assets/vendor/three`. The page is a real CV (every fact stays in
HTML, readable with no JS / no WebGL / Reviewer mode) layered over a persistent voxel night-time UCSD world:
- **Tour mode**: scrolling drives the camera (`game3d/director.js` reads `data-shot` / `data-side` / `data-zone` /
  `data-focus` / `data-say` in `index.html`; shots live in `game3d/stage.js`). The little scholar (voxel avatar of
  Yichen) walks to each section's stand spot; Education plays a Tsinghua -> UCSD teleport (`tour.warp`).
- **Play mode** (W, "Take control", or auto at the end of the page after a 3 s countdown): open-world action game.
  WASD camera-relative, mouse look (pointer lock), C/F5 first person, J/click 3-hit sword combo, 1-4 spells,
  V vehicles (flying sword -> Mk-35 Triton exosuit -> sports car), E use, M world map, L quest log, K dodge.
- **14 regions** behind hub doors (`game3d/regions/<id>.js`, lazy-loaded, 400-unit grid): tsinghua, picasso,
  samsung, metabit, timi, hotstar, lark, starry, im, oj, triton, stacks, finale (+ sandbox for devs). Each has
  enemies, a boss/puzzle awarding a "Road to Dr." item (13 total, `game3d/road.js`), NPCs, a side quest, 8-17 eggs.
  All 13 open the Defense (finale: committee boss, graduation, credits rolling the real CV).
- Page layer: `assets/js/site/**` (kit, progress/XP, HUD, chapters, eggs registry, Field Notes, terminal `~`).

## Branch / deploy
- Work branch: `claude/bold-maxwell-12zifa` (was `claude/ecstatic-mayer-xlwq56`). **Standing instruction from the user:
  merge into `main` every time (no PR).** Deploy = push to main; GitHub Pages is live ~40 s later at https://yil384.github.io.
- Push a verified commit to main with `git push origin <sha>:main` (main must be an ancestor; it is linear).
- Round 5 (2026-09-30) merged Hub 2.0 (verified: 14 regions clean, finale 27/27, stacks 20/20, starry/im/oj/triton
  playthroughs, tour shots vs the old main, desktop play, phone) plus the phone overhaul below.

## Phones (round 5)
- `game3d/touch.js`: the whole screen is one gesture surface in play (floating stick on the left half, look / pinch
  zoom / tap-a-plate-to-talk on the right), an action arc (attack, jump, E that lights up with Talk/Use, dodge,
  spell: tap casts, hold picks), a top row (map, vehicle, view, ☰ menu = `panels.js openMenu`, incl. Back to the page).
  Controls hide while any modal is open; iOS gesture/zoom guards while playing. WebGL2 forced on coarse pointers
  (`?webgpu=1` to try WebGPU), maxDpr 1.5 with the adaptive drop, GPU context loss reloads (max twice per visit).
- Phone CSS lives in `game.css` (touch block, `@media (pointer: coarse)` / `(max-height: 500px)` layouts for battle,
  dialog, map) and `site.css` (bar fits at 360 px with icon buttons and the gamepad; one egg toast at a time).
- No end-of-page auto-enter on touch. Field Notes has Terminal / Controls buttons on touch (the terminal also takes
  `yichen` and `konami`). `#world` keeps 100lvh on phones (browser bars no longer resize/re-aim the view).
- First paint: `assets/img/world-poster*.jpg` and `og.jpg` are baked from the live hero shot by
  `tools/dev/poster.mjs` (re-run it whenever the hub or the hero shot changes, and bump the `?v=` in site.css /
  index.html); the intro is a small push-in from that same shot.
- Probe: `tools/dev/mplay.mjs [w] [h] [out] [shots]` (real CDP touch: stick, look, jump, map, battle, menu, spell picker).

## TODO (priority order)
1. Real-device check on an iPhone and an Android phone (emulation only so far): floating stick feel, pinch zoom, iOS
   Safari bars, audio, frame rate on a mid-range phone. The new hub costs ~+75% sim CPU vs the old one at 4x
   throttle (still ~2 ms/frame); phones already run `ambient.update` and `updateHud` at 30 Hz.
2. (done) rb_* harnesses updated to the current regions (all pass).
3. (done) tour speech bubbles are clamped on screen and step out of each other's way.
4. Keep polishing "less AI flavour, more game feel and humour" wherever copy reads corporate.
(Done in round 5: dialog chains (npcs.js), engine helpers for regions (REGIONS_API §9), IM Unsubscribe egg verified.)

## Facts / tone rules (hard)
- Only use facts in `docs/dev/GAME_SPEC.md` "Allowed facts" and `index.html`. Jokes must read as jokes.
- Research focus (user-stated): **AI for science and chip design; architecture for agentic workloads; harnesses and
  benchmarks.** Do not describe him as a compilers / GPU-codegen person.
- Latest job: Samsung Semiconductor, summer research intern, Jun-Sep 2026, San Jose, architecture for agentic AI
  workloads (see the Experience row in index.html).
- TritonGym: Yue Guan*, Yichen Lin* (equal contribution), **under review, ICML 2026**. (Re)^2H_2O: IEEE IV 2023.
- Original characters only (no third-party IP / logos in sprites). Never punish the player (deaths and falls cost
  nothing). Every CV fact stays in HTML; phone, reduced motion, no-WebGL and Reviewer mode (R) must keep working.
- Humour target: "学术圈最好玩、彩蛋最多" (the most fun, most easter-egg-packed academic homepage). Tab-away
  titles like "Yichen Lin · Defeated by Claude". No "AI-flavoured" corporate copy.

## Testing toolkit (`tools/dev/`)
Serve the repo: `python3 -m http.server 8000` (from the repo root). Screenshots/output go to `/tmp/yl`
(`mkdir -p /tmp/yl`). Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`; Playwright is
imported from `/opt/node22/lib/node_modules/playwright/index.mjs` (adjust both if the image differs).
The software GPU renders ~1 fps: prefer `__g.sim(seconds)` (runs the game without rendering), `?norender=1`,
`?world=0` (page only), `?lowfx=1&dpr=0.5`, and just a few screenshots.
- `snap.mjs <url> <outPrefix> [w] [h] [targets]` screenshots; `ACTIONS='[["click","sel"],["eval","js"],...]'`.
  Targets: `top`, pixel offsets or CSS selectors. Mobile emulation when w < 700.
- `regsmoke.mjs <ids...>`: loads `?region=<id>`, sims, reports console errors.
- Full playthroughs: `node rc.mjs <starry|im|oj|triton> 0 ./rc_<id>.mjs`, `node rd.mjs <stacks|finale> 0 ./rd_<id>.mjs`,
  `node rb.mjs ...` (industry regions; see each file's header). Run them from `tools/dev/`.
- `camjit.mjs` camera oscillation metrics; `warp.mjs` samples the Education teleport; `perf.mjs` / `*_perf.mjs`
  draw calls and CPU ms (`?perf=1`).
- Lint: `npx eslint -c tools/dev/eslint.config.mjs "assets/js/**/*.js" --ignore-pattern "assets/vendor/**"`.
- URL flags: `force=1` (world even on weak devices), `intro=0`, `lowfx=1`, `dpr=<n>`, `region=<id>`, `road=all`
  (debug grant, with region), `perf=1`, `norender=1`, `world=0`, `webgl=1`.

## Lessons learned
- Only 4 CPUs: at most 2 heavy agents/test runs at once. Background long test loops.
- Several agents share ONE working tree: never switch branches / stash / reset while an agent works; commit only
  your own paths; push main with `git push origin <sha>:main`. To test while the tree is mid-edit, use a
  `git worktree add --detach /tmp/wt HEAD` copy served on another port.
- The page can grow after you reach the bottom (post-credits); "at the end" = the Enter panel is on screen.
- Headless smooth scroll is slow: use `scrollTo({ behavior: 'instant' })` in tests.
- `__g.sim` advances game time faster than wall clock: never use `performance.now()` for gameplay/camera easing.
