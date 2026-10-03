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

## Portrait flip (secret identity)
- A clean double-click / double-tap on the About photo (`#portrait`) flips it over like a card and plays a 14 s comic
  intro video on the back (the user's green-ninja minifigure clip, re-cut with captions); on `ended` / close / Esc /
  backdrop / tab hidden / error it flips back into the portrait's slot. Code: `assets/js/site/portrait-flip.js`
  (wired from `eggs-dom.js`, which ignores its 5-click voxel counter while the card is out), CSS at the end of
  `assets/css/ui/about.css`. Page egg `secret` (found on `ended` or a close after >= 3 s); Bit has an About hint.
- Files: `assets/video/intro.mp4` (H.264/AAC, listed first), `intro.webm` (VP9/Opus, for open-source Chromium),
  `intro-poster.jpg`; nothing is fetched before the first double-click. Re-render them with
  `tools/dev/introvid/render.mjs` (see its header); keep the `<source type>` codecs in portrait-flip.js in sync.
- Sound follows `S.settings.sound` (falls back to muted if play() is refused); html.rm crossfades instead of flipping.
- Probe: `node tools/dev/pflip.mjs [desk,world,plain,phone,rm]` (real double-click / CDP double-tap, 3 and 5 clicks,
  ended -> flip back + egg, Esc; screenshots `/tmp/yl/pf-*`). The test Chromium has no H.264, so it plays the WebM.

## Portrait swap (minifigure face)
- A lone click / tap on `#portrait` (no second one within `DOUBLE_MS` = 350 ms, so it never fires on a double-click or
  the 5-click voxel run) builds the minifigure version `assets/img/portrait-lego.webp` (the user's LEGO portrait,
  framed like the photo: crop box (192,140,1036,984) of the 1254px upload in commit e2e2f62, centered on the head
  (x 614), head = 54% of the frame, 7% above the hair; the "NINJAGO" lettering on the mountain was painted out first
  (letter mask, feathered clone of the rock 92 px above); 640x640 WebP q78; bump the `?v=` on `LEGO` in
  portrait-swap.js after a re-crop) out of 5x5 studded bricks pressed in row by row from the bottom; the next lone click pops
  them off from the top and the photo is back. Code: `assets/js/site/portrait-swap.js` (wired from `eggs-dom.js`,
  which counts the clicks: 1 = swap, 2 = flip, 5 = voxel; any click lands a running swap at once), CSS at the end of
  `assets/css/ui/about.css`, `sfx('snap')` per row. The `<img>` src / alt and the button's aria-label follow the face,
  so the flip card's front, the game's 48px pixel version and the voxel egg's way back all show the current face.
- Page egg `minifig` (first build); Bit has an About hint. html.rm crossfades. Nothing is fetched before the pointer
  or focus reaches the portrait.
- Probe: `node tools/dev/pswap.mjs [desk,plain,phone,rm,world]` (screenshots `/tmp/yl/ps-*`, bricks frozen mid-build
  and mid-pop).

## Play-mode toys (round 6)
- `game3d/emotes.js`: X (then 1-4 / click) or the touch `o/` button under the top row opens Wave / Dance / Think /
  Bow. Poses go through `emotes.pose()` (index.js `placeActors`, the scholar's rotation order is now YXZ so pitch and
  roll are in his own frame) and `weapon.setArmPose()`; any move, jump, swing, spell, vehicle cancels. Islanders in
  reach turn, hop (`npcs.js` `hopT` / `turnT`) and answer (per-id lines, `tsinghua-zhuo` counts as Zhuo); the crowd
  waves / dances along (`ambient.react()`); walking into a student gets "sorry!", cyclists ring. Bit comments
  (`bitSay`, rate-limited) on bunny hops, spinning on the spot (a dizzy wobble), dodging nothing, hard landings, kill
  streaks, standing idle (the scholar then thinks out loud). Eggs: `social`, `flashmob`, `bunnyhop`, `dizzy`.
- `game3d/toys.js`: two Triton-blue/gold balls (plaza by the spawn, RIMAC field) kicked by walking/driving into them
  or swinging at them; goals on the RIMAC field (now three blocks wide with nets, `districts.js`) score (egg `goal`);
  a ball lost at sea comes home. Price Center stands: E · order (free HP/MP, egg `foodcourt`). Library Walk club
  tables: E · take a flyer (six joke flyers, egg `flyers`). State in `S.world.data.hub`.
- Hits squash the target (`actors.flash`: wider and shorter for 140 ms) on top of the hit-stop.
- Reduced motion: poses hold still, the crowd does not hop. `__g.emotes` for tests (`emotes.play('dance')`).

## Ground, camera and overlap audit (round 6)
- Feet height: the tour walker sets `player.y` from `surfaceY` every step (it sank on slopes) and blinks to its goal
  after 1.5 s without progress. Scenery blocks the cells it is drawn on (world.js bake, stage.js prop footprints,
  regions.js `props()`, `walk: true` opts out). `tools/dev/ground.mjs` raycasts every cell of the hub and each region
  against `surfaceY` / `isBlocked`: keep it clean after terrain or prop changes.
- Play camera: `game3d/cutout.js` dithers a see-through cone of scenery between the camera and the scholar (play only;
  actors and shadows untouched); `camera.js` checks the sight line to the lens every 0.5 units and pulls in; blocked
  cells carry their real prop height (`worldgrid.js` `setTop` / `topAt`). Metrics: `node tools/dev/sweep.mjs cam`.
- `tools/dev/sweep.mjs` (layout, overlays, tour, play, cam, portals, save, rm, trap, spawns) is the general self-check.

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
- `coldload.mjs [desk|phone] [throttle] [runs] [query] [port]`: first-visit jank probe (fresh context, cache off, CDP CPU
  throttle, scrolling during load): long frames (LoAF), long tasks, time to live, and the world build phases
  (`performance.mark('yl:*')` from `game3d/index.js`). `WEBGPU=1` for the WebGPU backend, `PROFILE=1` for a CPU profile,
  `OUT=<label>` keeps the raw entries (`--summarize <files>` re-reads them). See its header.
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
- First load (cold cache) must stay smooth: `createGame` builds in phases that yield to a paint (`util.js`
  `yieldToPaint`; `buildWorld` / `buildStage` take a `pause`), every hub pipeline is compiled asynchronously for the
  scene pass's real render context BEFORE the first frame (`precompile` + `warmUp` in index.js: three r186 keys render
  contexts by call depth, and the pass renders inside RenderPipeline.render() with tone mapping off), so the first
  render compiles nothing. Small 2D canvases that are read back (toDataURL / getImageData) use
  `willReadFrequently: true` (a GPU readback waits behind the world's shader work). Check with `coldload.mjs`.
- `__g.sim` advances game time faster than wall clock: never use `performance.now()` for gameplay/camera easing.
