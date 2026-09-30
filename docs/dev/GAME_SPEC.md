# GAME_SPEC — round 4: "Yichen's World", a real open-world game behind the CV

Read BRIEF.md first (contract, tooling, hard constraints still apply: vanilla ES modules, no build, no CDNs, no
invented facts, original characters only, Reviewer mode/no-JS CV untouched). SPEC.md describes the round-3 page layer.

## User request (verbatim, round 4)
现在好很多了，但是确实有卡的时候，而且自由度不高啊，只能从上到下浏览，没有机会真正去玩啊，不应该是浏览完了就可以进去
游戏了吗？进去要超高自由度的探索和打怪，可以触发超多彩蛋（当然彩蛋都和我或者我的经历我的内容相关）

→ (1) fix jank. (2) After reading the page, the visitor should ENTER the game: very high freedom, exploration and
combat, tons of easter eggs, every egg tied to Yichen's real life/CV (facts below) or clearly-joke academic culture.

## Allowed facts (only these; jokes must read as jokes)
Research focus (user-stated, current): AI for science and chip design; architecture for agentic workloads; harnesses and
benchmarks. (Do NOT describe him as a compilers / GPU-codegen person any more.)
Yichen Lin — Ph.D. student UC San Diego CSE (2025–), advisor Prof. Yufei Ding; B.S. Computer Science & Technology,
Tsinghua University (2021–2025); roommate & labmate Zhuo Chen (Tsinghua Yao Class alumnus, "best cook in the building").
Papers: TritonGym (Yue Guan*, Yichen Lin* equal contribution; under review, ICML 2026; benchmark for agentic LLM
workflows writing Triton GPU kernels) · (Re)²H₂O (Haoyi Niu*, Kun Ren*, Yichen Lin et al.; IEEE IV 2023; autonomous-
driving scenario generation via reversely regularized hybrid offline-and-online RL).
Experience: Picasso Lab UCSD CSE research intern Mar 2024–Feb 2025 (CXL system simulator for large-model communication;
lab websites; RAG pipeline for reading papers) · Samsung Semiconductor summer research intern Jun–Sep 2026, San Jose (architecture for agentic AI workloads: runtime
optimizations for agent pipelines, simulating how future accelerators should support agent workloads; agentic test-debug
framework prototype for MLOps; multi-agent coordination, adaptive memory, human-AI collaboration) · Metabit quant developer intern Sep–Nov 2024 (faster data parsing,
streaming reads for the internal AI platform) · Tencent TiMi Studio game dev intern Jun–Jul 2024 (Monster Hunter
mobile client, voice-controlled teammates) · Disney+ Hotstar algorithm intern Mar–Jun 2024 (search page, fine-tuned
recommendation model for TPUs) · ByteDance Lark backend intern Jun–Nov 2023 (AskAI assistant for sales-data analysis
on Redis and RocketMQ).
Projects: Starry-Next (networking stack for a monolithic-kernel OS, Rust, graduation project) · IM System (real-time
chat, WebSocket + Django + TypeScript) · CST-OJ (online judge for data-structure coursework, Rust, sandboxed grading,
submission queue) · TritonGym (benchmark harness).
Skills: Python, C++, Rust, Go, TypeScript, JavaScript, Verilog; Linux, Vim, LaTeX, WebSocket, Django, MongoDB.
Places: UCSD (Geisel Library = Dr. Seuss, Sun God, King Triton, sea lions, Fallen Star, Snake Path, Scripps pier,
Torrey Pines gliders, "Fiat lux"); Tsinghua (二校门 Second Gate, motto 自强不息，厚德载物, 清华学堂, 大礼堂 auditorium,
荷塘 lotus pond / 荷塘月色, bicycles everywhere, 紫荆 dorms, Yao Class).
Never invent grades, awards, numbers, results, opinions of real people. Real people other than Yichen and Zhuo
(advisor, co-authors) are not depicted as characters; they may be credited by name in text only.

## Architecture (ENGINE package defines; region packages only call it)
The UCSD island stays the hub at origin. Every CV landmark on it becomes a door to a region. Regions are separate
islands far away in the same scene (e.g. origins on a 400-unit grid) reached by teleport; only the current region
(+ hub horizon silhouette optional) is visible/updated.

`game3d/regions.js` (ENGINE) exports:
- `registerRegion(def)`: def = { id, name, origin:[x,z], size, sky?{tint,fog}, build(ctx) } where build receives
  ctx = { region, scene group, world, rand, api } and returns nothing; it uses the helpers below. Regions are built
  lazily the first time you travel there (keeps first load fast) and stay built.
- Terrain helper `terrain(ctx, { size, height(x,z)->int|null, type(x,z)->palette key, palette:{key:[colours]} , skirt })`
  → instanced voxel terrain in region-local coords, registers height/walkable/type lookups into the composite world.
- `props(ctx, cells)` → voxBuild wrapper (landmarks.js/props.js style) in local coords; `block(x,z)`.
- `spawnEnemy(ctx, { kind, x, z, ...overrides })` with `registerEnemyKind(id, {name, hp, speed, dmg, type, xp, gold, sprite|art, flying, behaviour:'chase'|'ranged'|'charge'|'swarm'|'turret'|'wander'})`.
- `spawnBoss(ctx, { id, name, x, z, sprite|art, scale, hp, pattern: 'rings'|'fan'|'volley'|'nova'|'summon'|'charge'|[...combo], reward, drop, onDefeat })` — generic boss built from reusable attack patterns (the existing golem/mage/dragon patterns generalised + summon + charge).
- `spawnNpc(ctx, { id, name, sprite|art, x, z, face, talk:()=>node })` (same dialog node format as npcs.js; choices with next/action).
- `interactable(ctx, { x, z, r, label, prompt:'E · read', onInteract, once })` — signs, chests, plaques, computers, bikes…; shows a world plate when near.
- `trigger(ctx, { x, z, r, onEnter, once })` — area triggers for eggs/cutscene lines.
- `pickup(ctx, { x, z, sprite, onPick })` — collectibles.
- `portal(ctx, { x, z, to:'regionId'|'hub', at:[x,z], label })` — travel gates (glowing voxel arch). Hub portals are
  the existing landmarks (see below).
- `quest(def)` — `registerQuest({ id, title, region, steps:[{id, text, done:()=>bool}], reward })` shown in the quest tracker and the Quest log panel.
- `egg(id, name, hint, done)` → `registerEgg` with kind 'game' (idempotent) + `found(id)`.
- `say(who|npcObj, text)` world bubble; `banner(title, sub)`; `toast`.
- `setSky(regionDef.sky)` on arrival (fog colour/density, hemisphere tint); night stays the default mood.
The composite `world` object keeps its current API (height, walkable, isBlocked, surfaceY, zoneAt, typeAt, block,
unblock) and dispatches by position to the hub grid or a region grid, so combat/enemies/loot/camera keep working.

Hub doors (ENGINE wires, regions implement the far side):
| hub landmark | → region id |
|---|---|
| Tsinghua Second Gate (walk through the arch) | tsinghua |
| CSE building front door | picasso |
| flag-lark / flag-hotstar / flag-tencent / flag-metabit (touch the flag + E) | lark / hotstar / timi / metabit |
| monuments mon-starry / mon-im / mon-oj / mon-triton (E) | starry / im / oj / triton |
| Geisel Library entrance | stacks (papers) |
| Scripps pier end (boat) | fast-travel boat menu to any unlocked region |
Every region has a return portal to the hub. A world map (M) shows hub + discovered regions, click to travel once discovered.

## Player freedom (ENGINE)
- Jump (Space) with voxel-step climbing: can hop up 2-block ledges; sprint (Shift); dodge roll (Ctrl or double-tap
  direction) with i-frames; attack moves to J / left click (Space becomes jump). Update the HUD, help panel, coach.
- Fall damage none; falling off an island → gentle respawn at the region's portal (no death).
- Glide: holding Space while falling after unlocking "Torrey Pines glider" (egg/quest reward) → slow fall.
- Camera: free orbit with right-drag or Q/E rotate; mouse wheel zoom; auto-follow.
- Phones: on-screen joystick (left) + buttons (jump, attack, interact, spell) when `pointer: coarse`; play is now
  allowed on phones (currently desktop-only), with lowfx.
- Death in play mode stays gentle (respawn at region portal, lose nothing). Never affects the page layer.

## Entering the game from the page (ENGINE)
- Credits section gets a big primary CTA "Enter the world ▶" (and the hero title menu "Take control" stays, now on
  phones too). Pressing it: page UI fades, camera dives from the current shot to the scholar (1.2s), play HUD fades in,
  first-time coach with the new controls + "Your journey: collect a diploma, 5 badges, 4 relics, 2 seals".
- Esc / "Back to page" returns to the page at the same scroll position.
- The page's Field Notes shows game eggs grouped by region.

## Main quest: "Road to Dr." (STACKS/FINALE package owns the ending; ENGINE owns the tracker)
Collect: Tsinghua Diploma (tsinghua) · 5 internship Badges (picasso, metabit, timi, hotstar, lark) · 4 project Relics
(starry, im, oj, triton) · 2 paper Seals (stacks: TritonGym "Under review" seal, (Re)²H₂O "Published" seal). Each is
earned by finishing that region's boss/puzzle. All collected → the Geisel "Defense" finale (the Committee: three
masked owl-scholars, original characters, a 3-phase boss built from patterns), then a graduation cutscene on the Sun
God lawn (cap throw, fireworks from the sky shower, the scholar gets the hat), credits, "Dr. (Honorary)" title, NG+.
The tracker lists collected items; the pause/Quest panel shows a trophy board of all 12 items.

## Regions (content packages) — each: themed terrain & props, 3–6 enemy kinds (original sprites via art.js grids or
voxel props), 1 boss or puzzle-boss giving the item, 1–3 NPCs with dialog tied to the facts, 1 side quest, ≥6 eggs
tied to facts, ambient life. Size 32–56. All text in English (Chinese allowed for Tsinghua mottos/place names).
- tsinghua: 二校门 arrival, 清华学堂/大礼堂 silhouettes, lotus pond (荷塘月色: stand by the pond at night → moon reflection
  egg), bicycle racks (ride a bike = mount speed), dorm with Zhuo cooking (tomato & egg; feeding heals), Yao Class
  classroom with a whiteboard puzzle, CS&T building; enemies: Deadline Imps, Midterm Slimes, "Gaokao ghost" (joke);
  boss: "The Final Exam" (patterns: fan + summon quiz scrolls) → Diploma.
- picasso: CXL memory pool lab: platforms = memory tiers that move/link; enemies: Cache Misses, Page Faults; puzzle:
  route packets through the CXL switch; lab-website build terminal; RAG paper-reader NPC (a robot librarian) → Badge.
- metabit: trading floor: candlestick platforms that rise/fall with a live ticker (jumping puzzle), data streams;
  enemies: Latency Spikes, Malformed Rows (parse them); boss: "Flash Crash" → Badge.
- timi: hunting ground (Monster Hunter-flavoured, original monsters), voice-controlled teammate NPCs that obey typed or
  shouted commands (egg), boss: a big original wyvern → Badge.
- hotstar: stadium-shaped streaming hub; search bar arena; enemies: Cold-start Users, Buffering Spinners; boss:
  "The Recommendation Engine" on TPU racks → Badge.
- lark: office tower of messages; enemies: Cache Misses (Redis), Message Floods (RocketMQ queue); AskAI assistant NPC
  answering questions about sales-data charts (joke); boss: "Queue Backlog" → Badge.
- starry: kernel dungeon descending rings 3→0, packets as enemies, net stack floors (NIC → IP → TCP → socket) → Relic.
- im: chat maze of message bubbles, WebSocket handshake doors (101 Switching Protocols), spam bots → Relic.
- oj: CST-OJ tower: each floor is a test case; verdict enemies (WA, TLE, MLE, RE); top floor "Accepted" → Relic.
- triton: GPU arena: warps of thread enemies, CUDA OOM Golem boss (existing sprite) with memory-pressure mechanic,
  agent NPC writing kernels → Relic.
- stacks: Geisel "stacks" of books, TritonGym wing (Reviewer #2 boss already exists in the hub grove — here a
  "Rebuttal" encounter) → TritonGym Seal "Under review" (honest); (Re)²H₂O wing: a small driving-scenario arena where
  generated traffic scenarios spawn and you survive them (car = mount) → Seal "Published IEEE IV 2023"; plus the
  finale entrance.

## Performance (ENGINE, first thing to do)
Observed: jank on real hardware. Fix, measure what you can (draw calls, JS ms/frame, DOM writes):
1. Remove `backdrop-filter` from large page cards/bar over the live canvas (re-blurring an animating WebGL canvas every
   frame is very expensive); use a slightly more opaque gradient instead; keep blur only on small, static elements.
2. Tour mode: render at most 30 fps when the camera has settled and no fly-in/transition is running; full rate while
   the camera moves or in play mode. Pause rendering entirely while the world is fully covered or tab hidden (exists).
3. Shadows: 1024 map in tour mode, shadow map updated only every 2nd frame in tour mode; actors keep casting.
4. Bloom at half resolution if the API allows; adaptive DPR already exists — make it react faster (after ~1.5 s of
   slow frames) and recover when fast.
5. Page layer: audit per-frame DOM work (fx pins/labels projecting every frame → skip when nothing moved; only
   update pins that are visible); make sure no scroll handler does layout reads each event without rAF.
6. Hidden regions invisible and not updated; enemies/NPCs/pickups only tick in the current region.

## Work packages (≤2 agents at a time; strict file ownership)
- ENGINE (first, alone): performance; regions.js framework + composite world; generic enemy kinds/behaviours and
  pattern-based bosses; interactables/triggers/pickups/portals/quests APIs; hub doors; world map (M) + boat;
  movement (jump/sprint/dodge/glide/step-up), attack rebinding, touch controls, phone play; entering from the page
  (credits CTA, dive); Road to Dr. tracker + trophy board; an example region `regions/sandbox.js` proving every API
  (remove from the door list before finishing, keep as docs); REGIONS_API.md in the scratchpad describing the API
  exactly as implemented. Owns all of assets/js/game3d/* except regions/<content>.js, plus the page files it must
  touch for the CTA (credits.js/css, hero.js menu item) and css/game.css.
- REGIONS-A (academia): regions/tsinghua.js, regions/picasso.js.
- REGIONS-B (industry): regions/metabit.js, timi.js, hotstar.js, lark.js.
- REGIONS-C (projects): regions/starry.js, im.js, oj.js, triton.js.
- REGIONS-D (papers + finale): regions/stacks.js, regions/finale.js (Committee boss, graduation cutscene, in-game credits).
Region packages may add sprites to three/art.js ONLY in a clearly marked block `// ---- region:<id> sprites` appended
at the end of ART (to avoid conflicts, append via a separate file `game3d/regions/art-<id>.js` exporting grids that
the region registers with `registerArt(name, grid)` — ENGINE provides registerArt).
