# Handoff: yil384.github.io "most fun academic homepage"

Last updated 2026-09-30. Read this first, then `CLAUDE.md` (repo root), `docs/dev/GAME_SPEC.md` and `docs/dev/REGIONS_API.md`.

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
- Work branch: `claude/ecstatic-mayer-xlwq56`. **Standing instruction from the user: merge into `main` every time
  (no PR).** Deploy = push to main; GitHub Pages is live ~40 s later at https://yil384.github.io.
- Push a verified commit to main with `git push origin <sha>:main` (main must be an ancestor; it is linear).
- **main is at `b192a8d`** (verified). The branch is ahead with the **unverified Hub 2.0** work:
  `e54acbb`, `52e257d` (WIP snapshots), `728c1b0` (island 2.6x bigger, round diorama in a moving sea),
  `6e11422` (illustrated world map + minimap, fewer draw calls, re-framed tour shots), `e56e902` (door plates up
  close, signposts, beacons, map labels, shadow box). Its agent was stopped right before its final perf probes; it
  reported: all regions pass, full-fx draw calls 98 / 118 / 137 (settled / scroll / play; target <= ~130 in play),
  "mobile renders fine" (but see TODO 1: the user says mobile is unplayable).

## TODO (priority order)
1. **Mobile is broken / unplayable (user report).** Reproduce at 390x844 and 412x915 with `hasTouch/isMobile`
   (snap.mjs does this when width < 700): tour page layout over the world, the HUD, the title menu, and PLAY mode
   touch controls (joystick, right-half drag look, buttons for jump/attack/E/V/map), modals, battle UI, the world
   map. Check `(pointer: coarse)` paths in `game3d/input.js`, `assets/css/game.css`, `assets/css/ui/*.css`.
   Fix layout overflow, tap targets, performance (coarse maxDpr 1.25, lowfx), and anything that blocks play.
2. **Verify Hub 2.0 then merge to main**: every tour shot before/after (hero, about, education incl. the teleport
   framing: the gate AND CSE must be visible right of the Education card at desktop width, papers, experience
   with 6 flags incl. flag-samsung, projects, contact, credits), play mode (walk, doors to several regions and
   back, boat, map M, minimap), `tools/dev/regsmoke.mjs` for all 14 regions, perf probe `?perf=1`, phone.
3. The user's earlier complaints to keep an eye on (fixed, but confirm on the new hub):
   - blur/fog: DPR now up to 2 desktop, floor 1 (0.75 touch), adaptive drop only after 3 s slow and 6 s grace;
     bloom (0.5, 0.18, 0.05); fog 0.0062. Don't reintroduce a blurry look.
   - third-person camera jitter: eased ground lift + occlusion hold in `game3d/camera.js` (`place()`); verify
     with `tools/dev/camjit.mjs` (counts direction flips per walk; 0-1 is good).
   - Education must stay ONE steady shot (director `STEADY`), no camera swings between rows.
4. Known engine limitation: a dialog choice whose `action` opens another `dialog()` gets closed immediately
   (`npcs.js choose()`); regions use `next` instead. A fix was tried and broke the finale test; if you fix it,
   re-run `tools/dev/rd.mjs finale 0 ./rd_finale.mjs` (27 checks) and stacks (20 checks).
5. Engine niceties the region agents asked for: `regions.js` re-exporting `heal`, `openModal`, `h`, `dealDamage`, a
   `mount('car')` helper, official boss shield/damage-multiplier hooks (regions currently wrap `boss.hit`).
6. The IM "Unsubscribe" egg (10 spam kills in one visit) was never hit by a test.
7. Keep polishing "less AI flavour, more game feel and humour" wherever copy reads corporate.

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
