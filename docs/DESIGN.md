# DESIGN.md — yil384.github.io · "SORTIE" (authoritative design)

Spine: **Concept A — Hangar / Launch Sequence.** Grafts from B and C are marked `[graft B]` / `[graft C]`.
Every fact comes from `BRIEF.md` and is reproduced exactly; nothing is invented. Every video shot is implementable
with `studio/ANIMATION_GUIDE.md` (see `STORYBOARD.md`). Digest citations: **VE** = video-engine.md, **PP** =
three-postprocessing.md, **MAT** = three-materials-scenes.md, **VFX** = three-vfx-particles.md, **PB** = p5brush.md.

Decision record (scores in the return message): A wins on coherence, video craft and feasibility; B's neon city is the
heaviest to build and the most generic genre-wise; C's hero is the calmest and least "hot-blooded". A's two
weaknesses — the live three.js is invisible during the opening video, and Bit was redesigned into a drone — are fixed
here by the session-aware opening (§2.0) and by keeping Bit as the game's creature (§4).

---

## 1. Logline · world · motif

**Logline.** A pilot walks into a dark hangar; a kernel is compiled into a machine; the machine is launched over the
sea; and the island below turns out to be home.

**World.** A carrier hangar at night (steel, amber work lamps, cyan holograms) with a catapult tunnel that opens on a
blue morning sky and a small voxel island far below. The page is the base between sorties; the opening video is one
sortie. Colour arc of the whole site, top to bottom: **night steel + amber (hangar) → cream flood (launch) → cyan/blue
(flight) → gold dawn (home)**.

**Motif.** *Compiled into power.* The **tile-wave**: a grid of square tiles lights up in diagonal wavefronts, like a
scheduled GPU tile launch. It is the floor under the mech before every launch, the compile bar in the cockpit, the
section divider on the page, the HP/MP/XP bars in the game and the island plaza floor at the end. It is drawn the
same way everywhere: tiles are flat washes/quads; the wavefront is `smoothstep(front − 2, front, i + j)` over tile
indices `(i, j)`; a lit tile is `gold` at the front, cooling to `amber` then `steel` behind it.

**Lighting signature `[graft C]`.** Cold hues carry structure, warm hues carry events: a frame is never more than
~15 % warm until its event lands. Hulls get a hard warm rim (`cream`/`amber` `inkLine` on the lit silhouette) the
moment the event's light arrives — lamps in the hangar, the door flood at launch, the sun on the flight.

**Why it fits without cringe.** His work (TritonGym, GPU code generation, compilers, systems) *is* the sortie:
source → kernel → hardware → result. A mech is a big precise machine that does nothing until it is compiled,
scheduled and launched. The page never says "pilot" about him; the HTML copy is the CV facts, the metaphor lives in
the sets and the HUD labels. Tone: 90s–2000s OP — hard cuts on beats, held key poses, ink boil, no jokes, no chibi,
no painted SFX text. All designs original (mech, hangar, HUD glyphs).

---

## 2. Site structure

One page, one fixed full-viewport three.js canvas behind scrolling HTML, seven stations `S0…S6`. Scroll drives a
rail parameter `s ∈ [0, 6]` (lerped in `requestAnimationFrame` with a critically damped spring, never rendered
from the scroll handler). Inside a station the camera drifts (nothing is ever still, VE §3.5); between stations it
moves along a `CatmullRomCurve3` rail, with one **cut** (S2→S3), one **live p5.brush wipe** (S3→S4) and one
**`transition()` wipe** (S4→S5). Scene graphs are built once and switched with `Group.visible`; post graphs are built
once per tier and switched with `renderPipeline.needsUpdate = true` (PP §4, §7 idle pattern).

### Tiers `[graft B]` (decided once, after `await renderer.init()` + a 10-frame timing probe)

| tier | condition | what runs |
|---|---|---|
| **T2 full** | WebGPU backend, `hardwareConcurrency ≥ 6`, probe median < 20 ms, viewport ≥ 900 px | PP §7 full stack, all sets, all particles |
| **T1 lite** | WebGL2 fallback, or iGPU (probe 20–80 ms), or viewport < 900 px | PP §8 chain, sets S1 + S5/S6 live, S2–S4 lighter (see per-station rows), particles halved |
| **T0 poster** | `prefers-reduced-motion`, or software GPU (`WEBGL_debug_renderer_info` contains SwiftShader/llvmpipe, or probe > 80 ms), or WebGL init failure | no canvas; each station shows its poster JPG (a real frame from its video or a QA screenshot) as a static background; HTML unchanged |

The sandbox is SwiftShader, so it lands on T0 by the probe; QA forces `?tier=1` and `?tier=2&webgl` to test the
live paths headless (both backends). `?tier=` is a query override only.

### HUD language (all stations)

1 px `cyan` bracket corners `⌜ ⌝` on plates of 40 % `ink`; JetBrains Mono uppercase labels 11–12 px, tracking
0.12 em; station numbers as `01 / HANGAR`; Bebas Neue station titles; Inter body. Top-left: the station indicator
(updates on scroll). Top-right `[graft B]`: an honest telemetry line `WEBGPU · 16.6 MS · T2` (real backend name from
`renderer.backend.isWebGLBackend`, real frame time as an exponential moving average, real tier; on T0 it reads
`POSTER · —`). Letterbox bars (2 × 6 vh, `ink`) only during S0 and the S2→S3 cut. Grain and scanlines come from the
post stack (never CSS on text).

### S0 — COLD OPEN (hero, 100 vh)

* **Video.** **V1 "Sortie"** (26 s, `STORYBOARD.md`), poster = frame 20.5 s (the mech against the sun).
  Session rule `[graft B/C]`: on the first visit of a session V1 autoplays muted (`muted playsinline`, IO-started,
  VE §6.5); on later visits (`sessionStorage.sortie = 1`, wrapped in try/catch) the hero opens directly on the live
  hangar with a `▶ OPENING · 26 s` pill that replays V1 letterboxed. T0 shows the poster with the pill (no autoplay).
  `Esc` or the `SKIP` pill jumps to the end of the video.
* **Live layer during the video.** The canvas warms up behind the video (`renderer.compileAsync` + one hidden
  frame, PP §8); the DOM letterbox bars and the `SKIP` pill are live. Nothing else — the video *is* the first five
  seconds.
* **HTML.** `YICHEN LIN` (Bebas, §3.5 stamp) over the last 4 s of the video; subtitle in JetBrains Mono
  `PH.D. STUDENT · CSE · UC SAN DIEGO`; body line "Ph.D. student, Computer Science & Engineering, UC San Diego
  (2025–present), advised by [Prof. Yufei Ding](https://cseweb.ucsd.edu/~yufeiding/)."; four contact chips
  (`yil384@ucsd.edu`, GitHub `yil384`, LinkedIn `yichen-lin-206293384`, Google Scholar `itFHNzoAAAAJ`), a
  `SCROLL ⌄` pip.
* **Transition out.** V1 ends on an iris shut on the mech's visor glint. The page continues the film: a CSS
  `clip-path: circle()` iris opens from the same screen position over the live hangar, whose camera starts at the
  visor (head close-up, pose = V1 shot H) and pulls back to the S1 pose over 1.2 s. Scroll before the video ends
  = the same iris, immediately.

### S1 — HANGAR DECK (About)

* **Set.** The cradle: K-01 standing in a four-pillar gantry; Unit-7 `[graft C]` parked by the console as a static
  cel prop; 12 amber work lamps on the walls; `animeGround` grid floor (MAT §2g) whose `emissiveNode` carries the
  tile-wave (a `uniform` wavefront, runs once when the station is entered and once per 20 s of idle).
  Materials: `CelNodeMaterial` (MAT §2a, 3 steps, `shadowTint #3A2E6B`) shared by mech/gantry/Unit-7; lamps
  `MeshBasicNodeMaterial` with `emissiveNode = color.mul(3)` (MAT §2f) so only they bloom; halftone on the mech's
  shadow side only (PP §6.3). Dust: `createAuraStatic` sprites recoloured `amber`, 3 000 (VFX §5.1 closed-form,
  no compute). Walls carry a **baked p5.brush decal sheet** `[graft B]`: one 1024×512 canvas rendered once at load
  by `brush.esm.js` with a fixed seed (hazard chevrons, the tile-wave glyph, bay numbers as marks, no words) →
  `THREE.CanvasTexture` on two wall planes; zero per-frame cost.
  T2: `toonOutlinePass` 0.0035 + full PP §7 stack. T1: `toonOutlinePass` + PP §8, dust 1 200, no halftone.
* **Video.** **V2 "Cradle"** (10 s loop) in a 16:9 panel right of the About text (desktop) / above it (mobile),
  `preload="none"`, IO-started.
* **HTML.** Portrait `assets/img/portrait.webp` in a bracketed crew-ID frame (caption `YICHEN LIN`, JetBrains Mono,
  nothing else). Copy, verbatim facts: "Ph.D. student, Computer Science & Engineering, UC San Diego
  (2025–present), advised by Prof. Yufei Ding." · "B.S. Computer Science and Technology, Tsinghua University
  (2021–2025)." · "Research: systems, compilers, GPU code generation, tooling for LLM agents. Most recent:
  TritonGym, a benchmark for agentic LLM workflows that write Triton GPU kernels." · the crew note, kept exactly:
  "My roommate and labmate is Zhuo Chen (Tsinghua Yao Class), who is also the best cook in the building." Logos
  `ucsd-white.svg`, `tsinghua-white.png` as two plaques beside the education lines.
* **Transition.** Rail: from a low three-quarter at the mech's foot the camera rises to a wide high shot of the deck,
  then tracks toward the catapult tunnel mouth; the tile-wave runs across the floor toward the tunnel to lead the
  eye (VE §3.3).

### S2 — CATAPULT (Research & Publications)

* **Set.** The launch tunnel: 8 ring segments as one `LineSegments2` with `Line2NodeMaterial` dashed, `dashOffset`
  animated (VFX §5.2 fat-line variant); blast door = two `CelNodeMaterial` slabs at the far end. Floor: one `Mesh`
  with `.count = 1024` instanced quads (32×32) whose `emissiveNode = smoothstep(front−2, front, i+j)` in
  `gold→amber` — the motif driven by scroll: as the reader scrolls through the two publications the wave advances
  and the door opens (`door.rotation` from `s`). `speedLinesPass` (VFX §5.3a) `uAmount 0→0.6` with the door; T2 also
  `zoom 0→0.06` in the distortion group (PP §7 step 6).
  T1: same geometry, `speedLinesPass` only (arithmetic), no zoom blur.
* **Video.** **V3 "Catapult"** (12 s loop) in the station header panel, `preload="none"`.
* **HTML.** `02 / RESEARCH`. Paragraph: "Systems, compilers, GPU code generation, tooling for LLM agents. Most
  recent: TritonGym, a benchmark for agentic LLM workflows that write Triton GPU kernels." Two "mission log"
  cards, no links (none exist):
  1. **TritonGym: A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation** — Yue Guan\*, Yichen Lin\*,
     et al. (\* equal contribution) — status pill `UNDER REVIEW · ICML 2026` (`amber`).
  2. **(Re)²H₂O: Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online
     Reinforcement Learning** — Haoyi Niu\*, Kun Ren\*, Yichen Lin, et al. — pill `IEEE IV 2023` (`steel`).
* **Transition.** Door fully open at the second card; the camera dollies through the door into light:
  `flash` cream 6 frames + `impact` uniform held 3 frames (PP §6.8) → **cut** to S3, letterbox bars on for the cut.

### S3 — OPS ROOM (Experience + Education)

* **Set.** A dark round room with a holotable: `hologramMaterial` (MAT §2c, tint `cyan`, 90 lines, sweep 1.5) on a
  low-poly island (78 faces, the same authored mesh as the studio's) floating above the table, plus five hologram
  "mission markers" (vertical `Line2` pylons + `SpriteNodeMaterial` billboards carrying the five real logos,
  `map`, no bloom). Scrolling the list rotates the table so the active marker faces the camera. Floor:
  `createHoloGrid` (VFX §5.2). T2 post adds `afterImage` on the bloom texture, damp 0.8, for light trails when the
  table turns (PP §1.4); T1: bloom 0.25 only, 1 200 static "data motes" instead of 3 000.
* **HTML.** `03 / OPERATIONS`, five rows in BRIEF order, facts verbatim, logo + dates in JetBrains Mono:
  * Picasso Lab, UCSD CSE — research intern (Mar 2024–Feb 2025): CXL system simulator for large-model communication,
    lab websites, a RAG pipeline for reading papers. (`ucsd-white.svg`)
  * Metabit (乾象投资) — quantitative developer intern (Sep–Nov 2024): data parsing speed-ups, streaming reads for the
    internal AI platform. (`metabit.png`)
  * Tencent TiMi Studio — game developer intern (Jun–Jul 2024): client work on the Monster Hunter mobile game incl.
    voice-controlled teammates. (`tencent.svg`)
  * Disney+ Hotstar — algorithm developer intern (Mar–Jun 2024): search page optimisation, recommendation model
    fine-tuning for TPUs. (`disney-hotstar.svg`)
  * ByteDance Lark — backend developer intern (Jun–Nov 2023): the AskAI assistant for sales-data analysis on Redis
    and RocketMQ. (`lark.png`)
  `03b / TRAINING`: "Ph.D., Computer Science & Engineering, UC San Diego, 2025–present" · "B.S., Computer Science and
  Technology, Tsinghua University, 2021–2025".
* **Transition.** The holo island scales up to fill the frame while the room dims → **live p5.brush wipe** (§3.6,
  colours `[ink, cyan]`, 0.6 s); the set switches to S4 at k = 0.5 under full cover.

### S4 — ARMORY (Projects + Tools)

* **Set.** Four equipment bays in a row, each lit by its own amber lamp, each holding one original cel prop: an
  antenna mast with coiled cable (Starry-Next — networking), a paired-radio unit (IM System), a sealed judge's box
  with a queue of glowing slots (CST-OJ), a K-01 cockpit module with the tile-wave on its panel (TritonGym).
  Hover/focus on a card: T2 `outline()` with `selectedObjects = [prop]` (empty otherwise → no cost, PP §1.1);
  T1 `mrtNode` glow mask + `gaussianBlur` at `resolutionScale 0.25` (PP §1.16).
* **HTML.** `04 / EQUIPMENT`, four cards, one sentence each from BRIEF, real links only:
  * **Starry-Next** — networking stack for a monolithic-kernel OS, graduation project, Rust —
    github.com/yil384/Starry-Next · tag `Rust`
  * **IM System** — real-time chat over WebSocket, Django backend, web front end —
    github.com/yil384/Instant-messaging-system-frontend · tags `Django` `WebSocket`
  * **CST-OJ** — online judge for data-structure coursework: sandboxed grading, submission queue, Rust —
    github.com/yil384/CST-OJ-Rust · tag `Rust`
  * **TritonGym** — benchmark + evaluation harness for LLM agents writing Triton kernels — no link · tag `Python`
  `LOADOUT` grid, plain bracketed mono chips, no icons: `Python · C++ · Rust · Go · TypeScript · JavaScript · Verilog`
  and `Linux · Vim · LaTeX · WebSocket · Django · MongoDB`.
* **Transition.** Camera tilts up to a ceiling hatch that opens on sky → `transition(scenePassArmory, scenePassSky,
  wipeTex, ratio, 0.15, 1)` (PP §1.8) with a painted-brush wipe texture (a 512×256 greyscale PNG rendered once by
  the studio); both passes render only while `0 < ratio < 1`; otherwise the single active pass renders.

### S5 — HOME BASE (Island game)

* **Set.** The existing voxel island seen from the sky, restyled (§6): `paintedSky` (MAT §2d: zenith `#1E2A5E`,
  horizon `#E9557D`, sun `#FFD470`), `toonWater` (MAT §2h; reflector `0.25` on T2 only), island `InstancedMesh`es in
  `CelNodeMaterial` + box-scale hull outlines (MAT §3.2), horizon fog. K-01 parked on the plaza edge as a static
  landmark (same authored mesh, no collider). Clouds: 800 `SpriteNodeMaterial` billboards, 2-tone hard `step`
  (VFX §3.7 idea); T1 400.
* **Video.** **V4 "Home base"** (12 s) as the game teaser above the launch card; poster otherwise; plays on
  hover/tap and when in view.
* **HTML.** `05 / HOME BASE — Explore the island`. One line: "Side quest: a scholar in a blue robe, the companion
  creature Bit, islanders Nell, Unit-7, Mo, Tide, Fern and Ash, three bosses, and a sealed chamber." The existing
  launch button and its controls text; the game opens as today (full-screen overlay), restyled per §6.
* **Transition.** Slow spiral descent to plaza level (matches the game's opening camera).

### S6 — COMMS (Contact / footer)

* **Set.** S5's scene at dusk on the plaza; the mech's visor glint is the only emissive; grain 0.16. Rhymes with
  V1's last shot.
* **HTML.** `06 / COMMS`: `yil384@ucsd.edu` · `(858) 319-7361` · `CSE, UC San Diego, La Jolla, CA` · GitHub
  `yil384` · LinkedIn `yichen-lin-206293384` · Google Scholar `itFHNzoAAAAJ`. Footer: "Built with three.js
  (WebGPU, WebGL2 fallback) and p5.js + p5.brush; studio engine ported from ClaudeAnimationBase (MIT). Logos belong
  to their owners. No build step." plus a `▶ REPLAY OPENING` pill.

### Per-station three.js table

| Station | Scene objects (draw calls / tris est.) | Materials | Post T2 | Post T1 | Particles T2 / T1 |
|---|---|---|---|---|---|
| S1 Hangar | K-01 (14 parts), gantry, Unit-7, 12 lamps, floor, 2 decal walls (~44 / 48 k) | Cel ×1 shared, lamp emissive, animeGround, CanvasTexture basic | outline, bloom(emissive) 1.2/0.6 @0.5, halftone shadows, scanlines, vignette, grain 0.12 | outline, bloom 1.0/0.5 @0.25, vignette, scanlines 0.08, grain 0.08 | 3 000 / 1 200 aura sprites |
| S2 Catapult | 1 LineSegments2, door ×2, 1 024 instanced tiles (~12 / 26 k) | Line2NodeMaterial dashed, Cel, tile emissive | + speedLinesPass, zoom 0–0.06, impact on cut | speedLinesPass, impact | none |
| S3 Ops | holotable, holo island, 5 pylons + 5 logo sprites, floor grid (~28 / 22 k) | hologramMaterial, holoGrid, Cel | + afterImage(bloom) 0.8 | bloom only | 3 000 / 1 200 motes |
| S4 Armory | 4 props, 4 lamps, bays (~30 / 34 k) | Cel, emissive | + outline() on hover | mrt glow + gaussianBlur 0.25 on hover | none |
| S5 Home | island instanced voxels, water, sky, clouds, parked K-01 (~60 / 90 k) | Cel + hulls, toonWater, paintedSky, sprite clouds | bloom, vignette, grain; transition() during the wipe only | bloom 0.25, no reflector | 800 / 400 cloud sprites |
| S6 Comms | S5 at dusk | same | grain 0.16 | same | same |

Global rules: `new WebGPURenderer({ antialias: true, alpha: false })`; MSAA 4× on T2, `samples: 2` +
`pixelRatio ≤ 1.5` on T1 (PP §8); every graph ends in `vec4(rgb, 1)` (PP pitfall 21); nothing samples a texture after
`renderOutput()`; `Timer.connect(document)` pauses off-tab; the loop renders only when `s` changed, an animation is
live, or a 500 ms idle tick fires (lamp flicker).

---

## 3. Visual system

### 3.1 Palette — one table for site CSS and studio `PAL` (studio names in the first column)

| studio name | hex | site role |
|---|---|---|
| `paper` | `#0E1120` | page background, video paper |
| `ink` | `#0A0B14` | outlines, letterbox, impact frames |
| `night` | `#0F1530` | hangar walls, cards |
| `indigo` | `#1E2A5E` | hangar shadow, sky zenith |
| `steel` | `#3B4A6B` | hangar surfaces, cooled tiles, card borders |
| `slate` | `#5A6C8E` | rails, secondary text on dark |
| `mist` | `#8FA3C7` | motion streaks, secondary text |
| `cream` | `#F4EEDF` | headings, highlights, door light |
| `bone` | `#D8D2C2` | body text |
| `amber` | `#F2B84B` | work lamps, warm rim, `UNDER REVIEW` pill |
| `gold` | `#FFD470` | thrusters, dawn sun, the lit tile |
| `ember` | `#F26B3A` | impact accents, chromatic split (CSS layer) |
| `rose` | `#E9557D` | horizon, halftone lift |
| `cyan` | `#4FD6FF` | HUD brackets, holograms, links, visor |
| `teal` | `#2FA6A0` | water shallows, tags |
| `violet` | `#8A63D2` | sealed chamber glyph |
| `magenta` | `#D24FB8` | one accent only: hover trails |
| `sap` | `#5EA35C` | island green |
| **site additions** (add to `PAL` too) | | |
| `hull` | `#4E7DD1` | K-01 hull, the Pilot's coat |
| `hullShadow` | `#2C3E77` | K-01 shadow tone, robe shadow |
| `shadowTint` | `#3A2E6B` | cel shadow tint (`CelNodeMaterial` and studio `tone()`) |
| `skin` | `#F1C9A5` | faces |

Rule: no pure black or white anywhere (VE §3 colour rule); CSS `color-scheme: dark` fixed. Shadows shift
cool (violet), highlights warm (cream).

### 3.2 Fonts

Bebas Neue — station titles, the name, HUD numerals (`clamp(56px, 9vw, 96px)` titles). Anton — the station number
only (`01`, 120 px, 8 % opacity, behind the title). Inter 400/500 — body 17 px / 1.6. JetBrains Mono — labels,
dates, brackets, controls, 11–12 px uppercase. `font-display: swap`, all four preloaded from `assets/fonts`.

### 3.3 Icon / HUD

No icon font, no borrowed sprites. One inline `hud.svg` symbol sheet, 1 px stroke, `cyan`: bracket, chevron,
tile-wave glyph (4×4 tiles, two lit), link-out, mail, pin, play, skip. Brand logos only from `assets/logos`,
monochrome by `filter: grayscale(1) brightness(1.6)`, full colour on hover. Cards: 1 px `steel` border, bracket
corners, no rounded pills, no drop shadows. Section divider: a 1 × 24 row of the tile-wave that runs once when the
divider enters the viewport (CSS `steps()` on background-position of a sprite strip; no JS).

### 3.4 Letterbox / grain / scanlines

Letterbox only in S0 and during the S2→S3 cut (DOM bars, `steps(1)` timing). Post stack: grain 0.12 (T1 0.08),
scanlines 0.10 at half vertical resolution (T1 0.08), vignette 0.35; grain 0.16 in S6. Impact frames: 3 frames,
binary (PP §6.8). Videos carry their own static grain (VE §1.8) and are shown at scanlines 0 (the `<video>` is DOM,
outside the canvas).

### 3.5 Hero title animation (opening-credits stamp)

`YICHEN LIN`, Bebas Neue `clamp(64px, 17vw, 240px)`, `cream`, tracking 0.02 em, over V1's last 4 s. All steps are
keyed at 12 Hz with CSS `steps()` so it reads as drawn, not tweened. `T0 = video.currentTime ≥ 22.0` (polled per
frame; fallback on `ended`):

1. `T0 + 0.00 s` — the whole name appears in one frame as a 1 px `cyan` outline only
   (`-webkit-text-stroke`, transparent fill), offset 6 px right, 4 px up.
2. `T0 + 0.08 s` — outline snaps to its final position; the fill stamps solid `cream` in one frame. Two extra layers
   (`::before` `ember` shifted −3 px, `::after` `cyan` shifted +3 px, `mix-blend-mode: screen`) collapse to 0 by
   `T0 + 0.20 s`.
3. `T0 + 0.20–0.60 s` — hard horizontal slice: the middle 22 % of the glyph height shifts 10 px right for 2 frames,
   then back (`clip-path` on a duplicate layer).
4. `T0 + 0.60–1.00 s` — the ink underline is drawn live by p5.brush (§3.6 event 1) while the subtitle types in
   JetBrains Mono at 30 chars/s between brackets that expand from the centre.
5. `T0 + 1.00–1.40 s` — the four contact chips rise 8 px with `backOut`, staggered 60 ms; letterbox bars retract.

Reduced motion / T0: steps 1–2 delivered instantly; underline drawn in one frame.

### 3.6 Live p5.brush ink (`brush.esm.js`, 78 KB)

One `<canvas id="ink">`, `position: fixed`, `pointer-events: none`, 960×540 logical, `pixelDensity 1`, CSS-scaled to
the viewport, DOM-composited over the three.js canvas (never uploaded as a texture per frame, PB §8.6). Rules:
`brush.scaleBrushes(3)` once before `brush.add`, `brush.clear()` at the start and `brush.render()` at the end of every
drawn frame, `brush.seed(1000 + floor(t·12))` + `brush.noiseSeed(same)` per frame (12 Hz boil, matches the videos),
every stroke drawn around its own origin with `push/translate` (PB §0.8), **0 watercolour fills live**, ≤ 60 strokes
per frame, the canvas is redrawn only while an event is active (idle cost 0).

| # | event | trigger | strokes | duration |
|---|---|---|---|---|
| 1 | Title underline | §3.5 step 4 / T0 load | 1 `dry` stroke + 2 `inkfine` flicks, `amber` | draws 0.4 s, boils 1.2 s, then frozen |
| 2 | Station stamp | a `0N / NAME` title enters the viewport | bracket = 4 `ink` lines | 0.25 s |
| 3 | Catapult speed lines | S2 door ≥ 80 % open | 40 `speed`-style lines converging on the door (PB §12) | while scrolling in S2, else frozen |
| 4 | Ops→Armory wipe | S3→S4 rail crossing | 9 rows of `dry` (PB §12 brushWipe), `[ink, cyan]` | 0.6 s; set switch at k = 0.5 |
| 5 | Island reveal splat | S5 enters | 6 `ink` blobs + 12 flicks | 0.3 s |
| 6 | Wall decal sheet `[graft B]` | once at load | ~80 strokes into a 1024×512 offscreen canvas → `CanvasTexture` | one-off |

Mobile: strokes halved, wipe 6 rows. Reduced motion: 1 and 2 drawn in one frame, 3–5 disabled (plain cut at S3→S4),
6 unchanged.

---

## 4. Cast model sheets (2D painted, ClaudeAnimationBase manner: key views, emotions, hooks; VE §1.9)

### 4.1 The Pilot — Yichen's avatar

* **Likeness (from `assets/img/portrait.webp`).** Short dark hair with a straight fringe, thick straight brows,
  calm narrow eyes, no glasses. Drawn as a 2-line mouth and 2-stroke eyes; the brows carry the emotions.
* **Silhouette.** Tall narrow rectangle; a long `hull`-blue flight coat with a high collar over the island scholar's
  blue robe (the robe hem shows below the coat — continuity with the game); helmet under the left arm with a `cyan`
  visor. Reads at 40 % frame height in a medium shot (VE §3.9).
* **Colours.** Coat `hull #4E7DD1`, robe hem `hullShadow #2C3E77`, trim `cream`, skin `#F1C9A5`, hair `ink`, visor
  `cyan`, cel shadow `#3A2E6B`.
* **Key views (5).** front, ¾ front, profile, ¾ back (the look-up in the hangar), seated profile (reading in V2).
  `spinView` snaps to these; mirrored views flip with the helmet kept on the same side by a per-view flag.
* **Emotions (5).** `calm` (default; idle breathes on the beat, coat sways), `resolve` (brows flat, squint, chin down
  4 px — the OP look), `strain` (eyes shut 2 frames, teeth line), `joy` (open eyes, small smile, never a grin),
  `curious` (one brow up, head turn). Swaps go squint → swap → `take` → settle.
* **Hooks.** `armL`: helmet (V1) · `armR`: a paper (V2) · none in V4 (waves).
* **Idle.** `body(t)` beat-locked: breath `sin(bp·π)·2 px`, coat hem `spring` on every step.

### 4.2 Bit — the companion (one design, the game's creature) `[graft C]`

Small round `cyan` body (`#4FD6FF`, shadow `teal`), two big `ink` eyes with `cream` catchlights, stubby arms, a
`gold` antenna tip that pulses on the beat and is a light source (`glow()`). It floats (`wob` 6 px), tilts into
turns, never walks. In the hangar it wears a small maintenance harness with a clip-on scan lamp (a held prop, not a
redesign); the lamp's `cyan` beam is a `streak()`. **Views (3):** front, ¾, profile. **Emotions:** `neutral`,
`excited` (eyes widen, antenna springs), `alert` (eyes narrow to lines). No drone form exists.

### 4.3 Unit-7 — deck crew `[graft C]` (cel-3D, 60 faces)

The island's robot islander, on deck duty in the hangar. Box torso 6, cylinder head 20, arm cylinders 2×10, tread box
6, antenna cone 8. 2D face decal: two `amber` eye-strips and a mouth line (`emissive` on the site). Colours `slate`
hull, `steel` shadow. Emotions: head-tilt (`spring`), eye-strip blink, "OK" (strips become arcs). Poses: parked,
head-turn. It does the boring part: it is the one holding the diagnostic cable in V2.

### 4.4 K-01 "Kernel Frame" — the mech (a prop with a character's screen time)

* **Original design.** Heavy squared shoulders, narrow waist, long shins with a forward knee guard, twin backpack
  thrusters, one `cream` chest fin, a plain visor helmet with no face. Explicitly *not*: no V-antenna, no rabbit
  ears, no bird crest, no red/white/blue tricolour, no eyes. Chest emblem = the tile-wave glyph (4×4, two lit).
* **Colours.** Hull `#4E7DD1`, shadow `#2C3E77`, joints `steel`, trim `cream`, visor `cyan`, thrusters `gold`,
  rim `amber` at events.
* **Height.** 18 world units (the Pilot is 1.75 u: the foot alone is person-height).
* **Poses.** cradle rest, crouch (anticipation), launch stretch, flight profile, landing, parked (site).
* **Rig.** 14 convex parts sorted by pivot depth (VE §5.3); arms never cross the torso in any pose; visor is a
  named face quad for the glint decal (VE §5.6).

### 4.5 Islanders (V4 cameo only, front view + wave)

Nell (Archivist, owl, long `bone` coat), Mo (merchant, `ember` scarf), Ash (cartographer, `steel` apron) — the
existing three redrawn in cel; Tide, Fern and Unit-7 (island form) stay in the game only. Drawn tiny (u ≈ 8), waves
in staggered phases (no twinning).

---

## 5. Cel-3D prop list (studio `props.js`; face counts before culling; authored offline with three.js `Box/Cylinder/
Lathe` + `mergeVertices`, VE §5.9, exported as `{v, f}` JSON and reused by the site as `BufferGeometry`)

| Prop | Parts | Faces | Used in | Notes |
|---|---|---|---|---|
| **K-01 mech** | head 18, torso 36, pelvis 10, shoulders 2×12, upper arms 2×10, forearms 2×14, hands 2×10, thighs 2×10, shins 2×14, feet 2×12, thrusters 2×12, chest fin 6 | **≈ 290** (~150 visible) | V1 B/E/F/G/H, V3, V4, S1, S5 | 14 convex parts; visor decal quad |
| Gantry + cradle | 4 pillars ×8, 2 beams ×8, 2 cradle arms ×14, 2 cable trays ×6 | 88 | V1 A/B/C/E, V2, S1 | floor is `gridFloor` / tiles |
| Work lamp | box 5 + cone 8 | 13 each, ≤ 12 | V1 A, V2, S1 | lamp light is `glow()` |
| Launch tunnel + blast doors | 8 ring segments ×8, 2 door slabs ×10 | 84 | V1 E/F, V3, S2 | rings drawn far→near; near ring clipped via `projectSeg` |
| Unit-7 | 5 parts | 60 | V2, S1 | face decal |
| Island low-poly | body 40, library block 12, plaza slab 8, 3 trees ×6 | 78 | V1 F, V4, S3 (hologram) | plaza tiles are 2D washes |
| Sealed chamber door | slab 10 + frame 2 | 12 | V4 C | glyph is a 2D decal |
| Holotable + ops room | lathe table 24, 3 chairs ×10, console ring 24 | 78 | S3 only | — |
| Armory props | mast 14, radio 20, judge box 18, cockpit module 26 | 78 | S4 only | — |
| Thruster ribbons, dust rings, clouds, tiles, HUD rings, beams | — | 2D | all | `ribbon`, `ellPts`, washes, `inkLine`, `streak` |

Worst simultaneous frame (V1 F): mech ~150 visible + island 78 + tunnel mouth 40 = **≈ 268 ≤ 400**. The studio
asserts `faces ≤ 400` and `fills ≤ 3` per frame in `?render` mode and throws `[graft C]`.

---

## 6. Island game restyle spec (gameplay code untouched; `assets/js/game3d/*` logic stays)

1. **Materials.** Every voxel `InstancedMesh` → `CelNodeMaterial` (2 bands for small sprites, 3 for bosses) with
   box-scale hull outlines sharing `instanceMatrix`, thickness 0.1 voxel (MAT §3.2 steps 1–5).
2. **Sky / water / fog.** `paintedSky` (zenith `#1E2A5E`, horizon `#E9557D`, sun `#FFD470`), `toonWater` at the shore
   (no reflector on T1), fog to the horizon colour.
3. **Post.** The site's LDR finish (scanlines 0.10 / vignette 0.35 / grain 0.12; T1 values on T1) and bloom on
   emissive only (lanterns, the sealed chamber glyph in `violet`, the parked K-01's visor).
4. **HUD reskin** (`hud.js` markup unchanged, CSS only): bracket plates, JetBrains Mono numbers, Bebas zone name;
   the HP / MP / XP bars become tile rows (the motif) — 12 tiles each, lit `gold→amber`, cooled `steel`; quest
   tracker and minimap get the bracket frame; the minimap keeps its canvas.
5. **Landmark.** K-01 parked on the plaza edge as a non-interactive decoration (no collider, no NPC entry) from the
   same authored mesh JSON.
6. **Plaza.** The plaza floor gets the tile-wave `emissiveNode`, fired once when a quest completes
   (`bus` event → uniform, no gameplay change).
7. **Unchanged.** The scholar in the blue robe, Bit, Nell / Unit-7 / Mo / Tide / Fern / Ash, three bosses, the
   sealed chamber, all copy, controls and touch input. Run the existing game QA path (`qa/g2-open.png`) after.

---

## 7. Mobile · reduced motion · software GPU

* **Mobile (390 px, touch).** T1 or T0. One canvas at `pixelRatio ≤ 1.5`; S1, S5 and S6 keep their 3D sets; S2–S4
  show their video poster frames as static backgrounds under the same HUD; particles halved; V1 autoplays muted
  with `playsinline` (first visit only), V2–V4 load on tap; ink events halved; the HTML column goes full width with
  16 px gutters, no horizontal scroll; the game keeps its existing touch controls. First-view weight ≤ 4 MB video
  (V1 ≤ 3.5 MB mp4 / ≤ 2.5 MB webm) + vendored three (cached) + 78 KB brush.
* **Reduced motion (`prefers-reduced-motion`).** No video autoplay (posters + play buttons), no rail (fixed camera
  pose per station = the poster pose, crossfaded on scroll), no ink boil, no impact frames, no scanline roll, title
  stamped instantly, section dividers static. Toggles at runtime on the media-query `change` event.
* **Software GPU / no WebGL (T0).** No canvas; posters as station backgrounds; the page is fully readable; `<noscript>`
  posters as well. The telemetry line reads `POSTER · —`.

Budgets: video render 60 s × 24 = 1 440 frames; at 0.3–0.8 s/frame with 3 workers ≈ 3–6.5 min per full pass,
~5 review passes on V1 and 2–3 on the loops ≈ 45 min total; encode ≈ 3 min (x264 slow crf 21 `-tune animation`
`-maxrate 3M`, VP9 two-pass crf 34). three.js: ≤ 60 draw calls, ≤ 90 k tris per station; T2 ≈ 8–10 ms at 1080p on
a 2020 iGPU → probe demotes to T1 (≈ 4–5 ms).

---

## 8. Risk list

1. **WebGL2 fallback differs silently** (compute, VFX §2) — zero compute anywhere; every particle system closed-form.
2. **`softParticles` GLSL reserved-word bug** (VFX §0.3) — not used.
3. **MRT + MSAA on WebGL2** — T1 uses `samples: 2`, accepts single-sample if the extension is missing.
4. **Rail scroll jank** — `scrollY` sampled in rAF, spring-smoothed; `passive` listeners.
5. **Video→page seam** — the CSS iris is triggered by `currentTime ≥ 25.5` polled per frame, with `ended` and a
   28 s timeout as fallbacks; the live scene is pre-warmed; if the video stalls, the page opens anyway.
6. **Cel-3D sort artefacts on the mech** — convex parts, pivot-depth sort, arms never cross the torso.
7. **Fill blow-up in SwiftShader** — `paint()` counts fills per frame and throws above 3 in `?render` mode.
8. **Boil drift** — `boilSeed` per element and `rs('after')` reseeding; a `--strip` across every seam and hit.
9. **p5.brush standalone culling under transforms** — strokes drawn around their own origin; no zoom on the ink canvas.
10. **Output alpha translucency** (PP pitfall 21) — `alpha: false`, every graph ends `vec4(rgb, 1)`.
11. **First-frame stall on WebGL2** — `compileAsync` + one warm-up frame under the opening video.
12. **Bitrate spikes on the whip pan** — `-maxrate 3M -bufsize 6M`; grain amplitude 34 → 20 if needed.
13. **Game regression** — materials/CSS only; existing QA path re-run.
14. **Taste** — reviewer checklist (VE §2.3) on every contact sheet: silhouette test, no text, no jokes, no faces
    bigger than the story needs; SFX count is zero by design.
15. **Scope** — V1 first; V2–V4 can ship as posters and be added; V3 can drop to 10 s by removing the cool-down wave.

---

## 9. The first five seconds

At 0.0 s the page is paper-black with a faint floor grid. At 1.0 s amber work lamps start switching on, one every
quarter-beat, down a hangar that is visibly *painted* — boiling ink, watercolour grain, no CSS gradient anywhere. At
3.0 s the camera is at the foot of a machine taller than a house and tilting up its shin in real perspective drawn in
brush strokes, a warm rim catching each plate as the lamps reach it. Before a word is read the site has a place, a
scale, a hand-made medium and a beat — and when the video hands over, the same hangar is standing there live in
three.js, cel-shaded and inked, with the reader's scroll on the camera rail and an honest `WEBGPU · 16.6 MS` in the
corner. It looks like the opening of a show that does not exist, made about a GPU kernel.
