# STORYBOARD.md — the four videos (studio format, ClaudeAnimationBase manner)

Companion to `DESIGN.md`. Four clips, **60 s total** (26 + 10 + 12 + 12), 1280×720 at 24 fps (world 1920×1080,
`PROJECT.scale = 2/3`), **bpm 120** (beat = 0.5 s; every shot boundary and every hit is on a beat). Everything below
uses only the API in `studio/ANIMATION_GUIDE.md`; nothing needs a new engine feature. Shots are numbered `V1-A …` so
one agent can own one video (or one shot).

## Shared rules for every shot

* A shot is `fn(t, lt, dur)`, a pure function of `t`: no state, no `Math.random()`, `hash(i)`/`jit()` only after a
  `boilSeed(key)`. One key per actor/prop: `boilSeed('mech')`, `boilSeed('pilot')`, `boilSeed('bit')`,
  `boilSeed('unit7')`, `boilSeed('set')`, `boilSeed('fx')`, and `boilSeed('after')` when a character is done.
* Paint order: paper (automatic) → background washes → `cel3dPaint` set/actors (far→near) → 2D actors via
  `billboard` → `glow`/`streak` (after `flushBrush`, which `glow` does itself) → screen-space effects after `camEnd()`
  (`speedLines`, `flash`, `impactFrame`, `letterbox`, `iris`, `brushWipe`) → `letter` (V1-G only).
* Budgets per frame, asserted in `?render` mode: **≤ 3 watercolour `fill`s, ≤ 400 cel faces, ≤ 300 ink strokes.**
  Flat `wash` unlimited. Each shot lists its worst-case faces / fills.
* Cel-3D: `const cam = cam3({ pos, look, fov, roll })`; edges `'silhouette'` for the set, `'all'` (crease .72) for
  the mech; light **fixed per shot** in world space; hard-surface ink `curv 0`, characters `curv .35`; parts convex,
  sorted by centroid (the engine does it); edges via `projectSeg`, 2D things via `billboard` (never raw `project`).
* Camera shake and whip pans are 2D: wrap the 3D pass in `camBegin(960 + sx, 540 + sy, zoom, rot)`; one camera per
  shot.
* Characters animate `onTwos(t)`; cameras and effects do not.
* Impact frames: `impactFrame(1)` for 3 frames (2 in loops) on the downbeat, then `shakeXY(t, 18·exp(−a·3.5))`, then a
  12-frame hold of the result. `[graft C]` warm colour ≤ 15 % of the frame until the shot's EVENT lands.
* Text: the name card in V1-G only (`letter`). **Zero `sfx()` in all four videos.**
* Loops (V2, V3): every periodic term has a period dividing the duration; the frame at `t = dur` equals `t = 0`.
* World scale: 1 unit ≈ 1 m. K-01 is 18 u tall, feet centred at the origin, facing +z. The hangar's blast door is at
  z = +70; the camera "behind the mech" is at negative z looking +z. Lamps: 6 pairs at x = ±12, y = 9,
  z = −30 + 6k (k = 0…5). Tile floor: 32×32 tiles of 1.5 u centred on the origin (y = 0). Gantry pillars at
  x = ±6, z = ±4, cradle arms at y = 8. The Pilot is 1.75 u; Bit 0.6 u; Unit-7 1.7 u.
* Tile-wave (2D, everywhere): tiles are washes on the projected 33×33 grid points (not mesh faces). Tile `(i, j)`
  colour = `mixCol(PAL.steel, PAL.gold, smoothstep(front − 2, front, i + j))`, cooled by `mixCol(·, PAL.amber, .5)`
  two tiles behind the front. A wave is `front = (t − t0) · speed`.
* Palette = `PAL` (+ `hull #4E7DD1`, `hullShadow #2C3E77`, `shadowTint #3A2E6B`, `skin #F1C9A5`); no pure black/white.

---

## V1 — "SORTIE" · 26 s · hero opening · poster 20.5 s

| field | value |
|---|---|
| plays | S0 cold open: autoplay muted on first visit of a session; `▶ OPENING` replay afterwards; poster on T0 |
| logline | The Pilot wants to fly, but the machine is dark; the kernel is compiled, the sortie launches, and the island below is home. |
| colour arc | night steel + amber lamps (A–C) → cyan HUD in the visor (D) → cream flood (E) → sky cyan/blue (F) → gold dawn (G) → cyan glint on ink (H) |
| motif | the tile-wave: lamps chaining on (A), the compile bar (D), the plaza tiles (F) |
| Pilot's arc | calm → resolve → strain → quiet joy |
| props | K-01 (all parts), gantry + cradle, work lamps (2D billboards), launch tunnel + blast doors, island low-poly, thruster ribbons (2D) |
| cast poses | Pilot: walk (¾ front), stop, look-up (turn ¾ front → ¾ back), `resolve`; helmet on `armL`. Bit: float, orbit, `neutral`/`alert`. Unit-7: parked. |
| transitions | in: fade from paper · A→B cut on beat · B→C cut on action (Bit) · C→D iris on the helmet · D→E match cut on the gold pulse · E→F carried whip + streaks dissolve · F→G match cut on the sun · G→H cut on beat · out: iris shut on the visor glint |

### V1-A · 0.0–3.0 · "Light arrives" (faces ≤ 240, fills 0)
* **In.** `flash(1 − seg(t, 0, .5), PAL.paper)` over everything (fade from paper).
* **Camera.** `cam3({ pos: [0, 4, −40 + 2·ease(seg(t, 0, 3))], look: [0, 7, 10], fov: 40 })`, light `[.4, .8, .2]`.
* **On screen.** `gridFloor(cam, 0, 3, 30, PAL.steel, .5)` faint; the mech at rest at the origin painted with all part
  colours `mixCol(col, PAL.ink, .85)` (silhouette-dark) until lamps reach it; lamp pair k (k = 0…5) switches on at
  `tk = 1.0 + .25k`: `billboard(cam, lampPos, …)` draws a small `cream` wash rectangle + `glow(sx, sy, scale·2.2·backOut(seg(t, tk, tk + .2)), PAL.amber, .9)`
  and a floor pool `ellPts` wash `amber` at `washOp 60`. As each pair lights, the mech's parts within 8 u of that
  lamp's z step up one tone (`mixCol` toward their real colour) — light literally arrives on the hull.
* **EVENT.** The last pair lights at 2.25 and the whole silhouette stands.
* **Reads.** 0.0–0.6 darkness, a floor · 0.6–2.6 lamps chain on away from us (the motif in light) · 2.6–3.0
  something large stands at the end of the row (hold, boil only).

### V1-B · 3.0–6.5 · "Scale" (faces ≤ 320, fills 0)
* **In.** Cut on beat 6.
* **Camera.** `cam3({ pos: [5, 1.6, −9], look: kf(t, [[3.0, [0, 1.6, 0]], [3.8, [0, 1.6, 0]], [6.0, [0, 17, 0]]], easeOut), fov: 45 })`, light `[.5, .7, −.4]`.
* **On screen.** The mech's right foot fills the frame; Unit-7 (60 faces) parked beside the foot for scale, head-tilt
  `spring(t, 3.4, .8, 9)`; tilt up shin → knee guard → torso → pauldron with the tile-wave emblem (2D decal on the
  pauldron's named quad) → head, visor dark (`night` wash, no glint). Bit floats across from left to right on
  `arcPt([−4, 6, −6], [7, 12, −5], 2, seg(t, 4.0, 6.3))`, scan lamp on, `streak` beam sweeping the hull; Bit exits
  frame right at 6.3.
* **EVENT.** The head: the visor is off.
* **Reads.** 3.0–3.8 a foot as tall as a person (Unit-7 beside it) · 3.8–6.0 tilt up: shin, knee, torso, pauldron
  emblem · 6.0–6.5 the head, visor dark, hold.

### V1-C · 6.5–9.5 · "The Pilot decides" (faces ≤ 200, fills 0)
* **In.** Cut on action: Bit exits right (B) → enters left (C) at 6.5.
* **Camera.** Background set through `cam3({ pos: [−6, 1.6, −14], look: [0, 4, 0], fov: 38 })` (gantry base, tiles,
  mech legs in the far ground); actors 2D in `camBegin(960 + 18·sin(lt·.8), 540, 1)`.
* **On screen.** The Pilot: `stroll(t, 6.5, 7.8, −300, 760, 22)` on the floor line y = 820 (world px), ¾ front,
  helmet on `armL`, `calm`; slow stop (weight) with a coat `spring`. Bit enters left at 6.5, orbits the Pilot once
  (`arcPt`, 6.5–8.0), settles at his shoulder. 7.8–8.8 the look-up: eyes first (0.1 s), then `turn(t, 8.0, 8.25, ¾front, ¾back)` with `smearTrail`; coat settles with `spring`. 8.8–9.5 `emotions(t, [[6.5, 'calm'], [8.8, 'resolve']])`
  — squint, swap, chin down 4 px, hold. 9.2–9.5 the left arm raises the helmet to chest height (`armL` pivot rotates
  −0.9 rad, `easeOut`).
* **EVENT.** calm → resolve.
* **Reads.** 6.5–7.8 a person in a blue flight coat, helmet under arm, walks in and stops · 7.8–8.8 looks up (eyes
  lead, head follows, coat settles) · 8.8–9.5 resolve, helmet raised.
* **Out.** The helmet's visor screen position `hv = toScreen(helmetX, helmetY)` is passed to D.

### V1-D · 9.5–13.0 · "Compile" (faces 0, fills 0)
* **In.** `iris(hv.x, hv.y, lerp(0, 1500, easeIn(seg(t, 9.5, 9.95))))` opening from the helmet visor (from the
  inside, the frame is the visor).
* **Camera.** Locked, `camBegin(960, 540, 1)`; boil only.
* **On screen.** 9.5–10.3 the visor closes: a `night` wash slab descends from y = −100 to y = 0 (`easeOut`), with a
  `cream` reflection band (rotated wash rectangle, `washOp 90`) sweeping down 2 frames behind it. 10.3–11.5 three
  concentric HUD rings draw themselves: ring i (r = 260, 340, 420) is `inkLine(ellPts(960, 540, r, r, 64).slice(0, floor(64·seg(t, 10.3 + .3i, 10.7 + .3i))), 2.2, PAL.cyan, 'neon', 0)`
  plus 8 tick marks each. 11.5–12.5 the compile bar: 24 tiles (`rectPts`, 44×44 world px, pitch 46, laid out
  right-to-left so that tile 24 — the last one — is centred exactly at (960, 540); tile 1 is at x = 960 − 23·46) lit
  by a wave `front = (onTwos(t) − 11.5) · 26` in `steel → amber → gold`. At 12.5 the last tile pulses `gold` with
  `glow(960, 540, 120·pulse(t, 6), PAL.gold, .9)` — this screen point is the match-cut anchor for E. 12.5–13.0 the
  Pilot's eyes appear as a reflection: the face decal (eyes + brows only) at `washOp 110`, emotion `resolve`,
  centred at (960, 400).
* **EVENT.** The compile bar completes; the last tile goes gold.
* **Reads.** 9.5–10.3 visor closes · 10.3–11.5 rings draw · 11.5–12.5 the bar fills, last tile gold · 12.5–13.0 his
  eyes in the reflection: resolve.

### V1-E · 13.0–16.5 · "Launch" (faces ≤ 330, fills 2)
* **In.** Match cut: the first frame of E has `glow(960, 540, 120, PAL.gold, .9)` on the door seam at the same screen
  point, fading over 0.3 s as the doors part.
* **Camera.** `cam3({ pos: [0, 6, −30], look: [0, 8, 40], fov: 42 })`, light `[0, .3, 1]` (the light comes from the
  door: contre-jour). Shake after the hit: `camBegin(960 + sx, 540 + sy, 1, whip·1.2)` with
  `[sx, sy] = shakeXY(t, 18·exp(−(t − 15.125)·3.5))` for t > 15.125, `whip = easeIn(seg(t, 15.4, 15.9))`.
* **On screen.** Two door slabs (10 faces each) slide apart `x = ±14·easeOut(seg(t, 13.0, 14.2))` at z = 70; the gap
  is a `cream` watercolour `fill` (bleed .3, `fillOp` rising with the gap) plus a second wider `fill` halo at
  `fillOp 60` (the two fills of this shot) and `glow` at the seam. The mech's part colours go toward `ink` as the
  light grows (`mixCol(col, PAL.ink, .4 + .5·gap)`), with a `cream` rim `inkLine` on the door-facing silhouette
  edges (the warm rim of `[graft C]`). Crouch 14.2–14.45 (`ease`): pelvis y −1.4, thighs `rot.x +.35`, shins
  `rot.x −.7`, torso `rot.x +.15`; hold to 14.9. Thrusters ignite at 14.6: `glow` gold, r grows `backOut`.
  **15.0 impact frame** (beat 30): `impactFrame(1, PAL.cream)` 3 frames with every mech face painted `ink` and
  `speedLines(960, 540, 1, 64, PAL.ink, 2)` radiating from the mech's chest. From 15.125 the mech is gone:
  `pos.z += ((t − 15.125)·16)²`, thruster ribbons `ribbon(through(trailPts), 26, 4)` in `gold` wash + `glow`. Whip pan
  right 15.4–15.9 with `streaks`-style horizontal wash bars (16 bars at `hash` heights, `mist`/`cream`) and
  `flash(.5·whip, PAL.cream)`. The empty cradle arms rock: `ring(t, [15.125])` on their `rot.z`.
* **EVENT.** Launch.
* **Reads.** 13.0–14.2 doors part, light grows, the mech blackens against it · 14.2–14.9 crouch, thrusters ignite ·
  15.0–15.125 impact frame · 15.125–16.5 gone: whip, streaks, the empty cradle rocking.

### V1-F · 16.5–20.0 · "The world" (faces ≤ 270, fills 3)
* **In.** Carried: the whip's streak bars dissolve with `washOp · (1 − seg(t, 16.5, 16.75))`.
* **Camera.** Orbit around the mech (fixed at the origin, flying +z; the world moves past it):
  `a = lerp(−60°, 0°, ease(seg(t, 17.4, 19.2)))`, `cam3({ pos: [34·sin(a), 6, 34·cos(a)·(−1)], look: [0, 2, 0], fov: 36 })`
  (behind → full profile). Light `[.6, .8, −.2]` (sun ahead-right).
* **On screen.** Sky: 3 band washes `indigo → cyan → cream` plus **1 `fill`** haze at the horizon; sun `glow`
  (gold) at screen (960, 430) by the end of the shot; **1 `fill`** cloud bank; sea = 4 `teal`/`indigo` band washes
  with a horizontal streak field (16 `inkLine`s scrolling `−t·(2400 + 1600k) mod 3000`). Tunnel mouth (one ring
  segment + a slab, 40 faces) at `z = −20 − (t − 16.5)·30` receding. The island (78 faces) at
  `[−20, −60, 80 − (t − 16.5)·14]` slides into view below; its plaza tiles (2D washes at billboard-projected
  points) run one tile-wave 19.2–20.0 (**1 `fill`** glow pool under the plaza = the third fill). Thruster ribbons as
  in E. Mech pose: flight profile (legs together, arms back).
* **EVENT.** The island below.
* **Reads.** 16.5–17.4 tunnel mouth, sea, speed (streak field) · 17.4–19.2 orbit: the full profile, thruster trails
  · 19.2–20.0 the island below, plaza tiles catching light.
* **Out.** Match cut on the sun: the sun `glow` sits at (960, 430) in the last frame of F and the first of G.

### V1-G · 20.0–24.0 · "The name" (faces ≤ 150, fills 2) · **poster 20.5**
* **In.** Cut on beat 40, sun in the same screen position.
* **Camera.** `cam3({ pos: [0, 2, −40], look: [0, 8, 60], fov: 40 })` with a slow drift
  `camBegin(960 + 10·sin(lt·.5), 540 + 6·sin(lt·.35), 1)`. Light irrelevant: the mech is a silhouette
  (`noShade: true`, all faces `ink`, ink `null`).
* **On screen.** Sky bands `cream → gold → rose` (washes) + **1 `fill`** haze; the sun as a `gold` wash disc r = 260
  at (960, 430) with **1 `fill`** pool and `glow`. The mech small at `[0, 10, 40]` (≈ 330 px tall), flight profile,
  thrusters as two `gold` glows; at 23.0 it tips a thruster: `rot.z = .08·spring(t, 23.0, .6, 7)` (a small wave).
  **Name card** 21.0–22.6: `letter('YICHEN LIN', 300, 880, 120·backOut(seg(t, 21.0, 21.4)), PAL.cream, { align: 'left', stroke: PAL.ink, strokeW: 4, alpha: seg(t, 21.0, 21.2) })`,
  then an underline `inkLine([[300, 910], [300 + 700·easeOut(seg(t, 21.6, 22.2)), 914]], 6, PAL.amber, 'dry', 0)`.
  (The HTML title stamps over this card at `currentTime ≥ 22.0` in the same 16:9-mapped position, DESIGN §3.5; on
  phones the HTML title uses its default bottom-left position.)
* **EVENT.** The name.
* **Reads.** 20.0–21.0 silhouette against the gold disc (poster at 20.5) · 21.0–22.6 the name card paints ·
  22.6–24.0 hold; the mech tips a wing-thruster.

### V1-H · 24.0–26.0 · "Glint" (faces ≤ 40, fills 0)
* **In.** Cut on beat 48. `letterbox(1)` on for the whole shot.
* **Camera.** `cam3({ pos: [0, 16.5, −5], look: [0, 16.3, 0], fov: 30 })` — the head only (head 18 faces + shoulders).
  Light `[.5, .6, −.7]`.
* **On screen.** Visor `cyan` wash on the named face quad; a `cream` glint (rotated wash rectangle) sweeps across it
  24.0–24.8 (`easeOut`) with a `glow` cyan at the visor centre `vc = billboard` point of `[0, 16.4, 1.2]`.
  24.8–25.5 `iris(vc.x, vc.y, lerp(1500, 3, easeIn(seg(t, 24.8, 25.5))))`; 25.5–26.0 full `ink` (iris r < 4 paints
  the frame).
* **EVENT.** The iris shuts on the glint; the page takes over from the same screen point.
* **Reads.** 24.0–24.8 glint · 24.8–25.5 iris shut · 25.5–26.0 black.

---

## V2 — "CRADLE" · 10 s loop · S1 About panel · poster 3.6 s

| field | value |
|---|---|
| plays | S1 panel, `preload="none"`, IO-started, loops |
| logline | The machine rests; the Pilot reads; Bit does the rounds; Unit-7 holds the cable. |
| colour arc | steel + amber only; one cyan beam; one 2-frame cyan visor flicker |
| motif | a tile-wave crosses the floor once per loop under Bit |
| Pilot's arc | content → curious → content (one head turn) |
| props | K-01 (upper body in frame; lower parts off-frame cost nothing), gantry + cradle, 4 work lamps (2D), Unit-7 |
| cast poses | Pilot: seated profile (reading), turn to ¾ front and back, `calm`/`curious`, paper on `armR`. Bit: float loop, scan lamp, `neutral`. Unit-7: parked, cable in hand, head-tilt. |
| loop rule | every term periodic in 10 s: Bit path phase `lt/10`, camera drift `sin(lt·TAU/10)`, lamp pulse on the beat (20 beats), Pilot pose identical at 0 and 10 |

### V2-A · 0.0–10.0 · one shot (faces ≤ 270, fills 1)
* **Camera.** `cam3({ pos: [−14, 9, −16], look: [0, 10, 0], fov: 38 })` inside
  `camBegin(960 + 18·sin(lt·TAU/10), 540, 1)`. Light `[.4, .8, −.3]`.
* **On screen.** Mech chest, shoulders and head three-quarter; the cradle arm at y = 8 with the Pilot seated
  (`billboard(cam, [−3, 8.3, 2], …)`, seated profile, paper on `armR`, `calm`, breath on the beat); Unit-7 at the foot
  (`[4, 0, −3]`) holding a cable to the shin (cable = `inkLine` `through` of 4 points, `steel`); lamps breathing:
  `glow` radius `·(1 + .08·pulse(t, 4))`; the floor lamp pool is the shot's **1 `fill`**. Bit floats along the hull on
  a closed path `p(φ) = [−6 + 8·sin(φ), 9 + 3·sin(2φ), −4 + 5·cos(φ)]`, `φ = lt/10·TAU`, scan lamp beam
  `streak(sx, sy, 140·scale, 8, PAL.cyan, .6, angle-to-hull)`.
* **EVENTS by read.**
  0.0–2.0 the machine at rest (lamps pulse on the beat, boil) ·
  2.0–4.5 Bit's beam sweeps a shoulder panel; at 3.5 a spark burst (20 particles, phase `frac((t − 3.5)·2 + hash(i))`,
  radial `cream`/`amber` `inkLine` flicks, 0.5 s) — poster at 3.6 ·
  4.5–6.5 the Pilot looks up at the spark: `turn(t, 4.5, 4.7, seated-profile, ¾front)` with `smearTrail`, emotion
  `curious` (one brow), then `turn` back at 6.0, `calm` ·
  6.5–9.0 a tile-wave crosses the floor under Bit (`front = (t − 6.5)·12` diagonally); the visor flickers once at
  8.0 (`glow` cyan on the visor point for 2 frames: it is "listening") ·
  9.0–10.0 everything settles to the 0 s pose (`spring(t, 9.0, .8, 8)` on the Pilot's head, Unit-7's head-tilt
  returning), lamps at phase 0.

---

## V3 — "CATAPULT" · 12 s loop · S2 Research header · poster 4.8 s

| field | value |
|---|---|
| plays | S2 header panel, `preload="none"`, loops through its own brush wipe |
| logline | A grid becomes power. |
| colour arc | steel → gold (floor lit) → cream (impact) → steel (cool-down); the loop's wipe is `[steel, cream]` |
| motif | the tile-wave, literal: 4 wavefronts under the mech's feet |
| props | K-01 (full), tile floor (2D washes on projected grid points), 4 work lamps (2D), dust ring (2D), tunnel ring (1 segment, 8 faces) at the frame edge in B |
| cast poses | none (machine only) |
| loop rule | C ends with `brushWipe((lt − (dur − .3)) / .6)` and A starts with `brushWipe(.5 + lt / .6)`; the wipe frames cost ≈ 0.75 s each (14 frames) |

### V3-A · 0.0–5.5 · "Wavefronts" (faces ≤ 160, fills 0)
* **In.** `if (lt < .3) brushWipe(.5 + lt / .6, [PAL.steel, PAL.cream])`.
* **Camera.** Top-down descending: `cam3({ pos: [0, kf(t, [[0, 46], [5.5, 38]], ease), −10], look: [0, 0, 2], fov: 40, roll: .14·ease(seg(t, 0, 5.5)) })`.
  Light `[.3, 1, .2]`.
* **On screen.** The mech from above at the grid's centre (head, shoulders, thruster backs, feet: ~160 visible
  faces); the 32×32 tiles as washes (1 024 washes, ~50 ms); four diagonal waves start at 1.5 / 2.5 / 3.3 / 3.9 s with
  speeds 8 / 12 / 18 / 26 tiles·s⁻¹, each leaving the floor one step brighter (`steel → mixCol(steel, amber, .35) → amber → gold`);
  thruster glows warm from r = 0 at 3.0 to r = 90 at 5.5 (`ease`).
* **EVENT.** The floor is fully lit; thrusters gold.
* **Reads.** 0.0–1.5 a dark grid and two feet · 1.5–4.0 waves cross, each brighter (poster 4.8) · 4.0–5.5 the whole
  floor lit, thrusters gold.

### V3-B · 5.5–9.0 · "Launch" (faces ≤ 170, fills 0)
* **In.** Cut on beat 11 as the last wave hits the far wall.
* **Camera.** `cam3({ pos: [34, 6, 0], look: [0, 8, 0], fov: 40 })` in `camBegin(960 + sx, 540 + sy, 1)` with
  `shakeXY(t, 14·exp(−(t − 6.08)·3.5))` after the hit.
* **On screen.** Crouch 5.5–5.9 (the V1-E pose values, `ease(seg(t, 5.5, 5.75))`, hold); **6.0 impact frame**
  (2 frames, `impactFrame(1, PAL.cream)`, faces `ink`, `speedLines` from the feet); from 6.08 the mech rises
  `y = ((t − 6.08)·14)²` and is out of frame by 6.6, thruster ribbons + `gold` glows; radial `speedLines(960, 700, 1 − seg(t, 6.08, 6.6), 48)`;
  dust ring: two `ellPts` washes (`bone` `washOp 120`, `mist` `washOp 60`) at the feet expanding
  `rx = 900·easeOut(seg(t, 6.1, 7.5))`, `ry = rx·.28`, fading. 7.5–9.0 the tiles cool `gold → amber → steel` in a
  reverse diagonal wave (`front` running back at 14 tiles·s⁻¹).
* **EVENT.** Launch.
* **Reads.** 5.5–5.9 crouch · 6.0–6.08 impact · 6.08–7.5 gone; dust ring expands · 7.5–9.0 tiles cool in reverse.

### V3-C · 9.0–12.0 · "One tile" (faces 0, fills 0)
* **In.** Cut on beat 18 back to the top-down pose of A's last frame (`pos [0, 38, −10]`, roll .14), tiny drift.
* **On screen.** Empty floor, all tiles `steel` except the centre tile, which pulses `gold` on the beat
  (`mixCol(steel, gold, pulse(t, 5))` + a small `glow`); the lamps dim (`glow` alpha `1 → .3` over 9.0–11.0).
* **EVENT.** The one lit tile — the motif.
* **Reads.** 9.0–11.4 the floor, one tile alive · 11.4–12.0 the wipe covers.
* **Out.** `if (lt > dur − .3) brushWipe((lt − (dur − .3)) / .6, [PAL.steel, PAL.cream])` → into A.

---

## V4 — "HOME BASE" · 12 s · S5 game teaser · poster 7.5 s

| field | value |
|---|---|
| plays | S5 above the "Explore the island" card; poster by default, plays on hover/tap and when in view |
| logline | From the sky, the island; on the plaza, everyone waits. |
| colour arc | cyan sky + gold dawn (A) → the island's `sap` green, `bone` stone, warm dust (B) → `violet` on `night` at the sealed door (C) |
| motif | the plaza's tiles lit like the catapult floor as the mech comes down |
| props | K-01 (landing pose), island low-poly + plaza tiles (2D), sealed chamber door, thruster ribbons (2D), clouds (2D) |
| cast poses | Pilot with `coat:false` (robe only = the game's scholar): run (¾ front), stop (squash), wave (`armR` arc), `joy`. Bit: run/float alongside, `excited`. Nell, Mo, Ash: front view, `wave`, staggered phases. |
| transitions | in: iris from the sun · A→B carried (the camera lands with the mech) · B→C pan left with smear · out: iris to the door glyph |

### V4-A · 0.0–4.0 · "Descent" (faces ≤ 230, fills 2)
* **In.** `iris(sun.x, sun.y, lerp(0, 1500, easeIn(seg(t, 0, .5))))`, sun at screen (1180, 300).
* **Camera.** Follows the mech: `m = kf(t, [[0, [40, 90, 60]], [4.0, [4, 6, 8]]], ease)`;
  `cam3({ pos: [m.x − 12, m.y + 8, m.z − 18], look: m, fov: 40 })` (25° down-tilt results). Light `[.6, .8, .2]`.
* **On screen.** Sky bands `cyan → cream` with **1 `fill`** haze; sun `glow` gold; **1 `fill`** cloud bank drifting;
  sea band washes; the island (78 faces) at the origin growing as we descend; the mech in flight profile → landing
  pose (legs forward from 3.0, `ease`); thruster ribbons; the plaza tiles (2D washes at the island's plaza slab)
  run a tile-wave 3.0–4.0 (`front = (t − 3.0)·10`).
* **EVENT.** The plaza lights up for the landing.
* **Reads.** 0.0–1.2 sky, sun, an island · 1.2–3.0 the mech descends toward it (ribbons) · 3.0–4.0 the plaza's
  tiles glow.

### V4-B · 4.0–8.5 · "Home" (faces ≤ 230, fills 1) · **poster 7.5**
* **In.** Carried: the camera settles to `cam3({ pos: [−16, 2.5, 14], look: [0, 4, 0], fov: 40 })` over 4.0–4.6
  (`kf` from the last A pose, `easeOut`). Light `[.6, .8, .2]`. Sky **1 `fill`** haze only.
* **On screen.** The mech lands 4.0–5.2: descent slows (`easeOut`), touches at 5.0 with a 1-frame `impactFrame(.8)`,
  `shakeXY(t, 10·exp(−(t − 5.0)·4))`, dust washes (two `ellPts`, expanding, fading) and a small `spring` bounce on
  the pelvis; 5.2–6.8 the scholar (Pilot, `coat:false`) and Bit run in from the left (`stroll(t, 5.2, 6.4, −200, 620, 20)`
  on the plaza line; Bit on a parallel `arcPt`, half a beat behind — no twinning) and stop with a squash
  (`jump`-style `sq` at 6.4); 6.8–8.5 Nell, Mo and Ash wave from the library steps (`billboard` at `[6, 3.2, −4]`,
  `[7.5, 3.2, −3]`, `[9, 3.2, −2]`, phases offset by `hash(i)·.4`); the scholar waves back (`armR` arc `sin` 2 Hz,
  emotion `joy`), Bit `excited` (antenna `spring`).
* **EVENT.** The wave.
* **Reads.** 4.0–5.2 landing (weight: slow stop, small bounce) · 5.2–6.8 scholar + Bit run in, stop · 6.8–8.5 the
  islanders wave; the scholar waves back (poster 7.5).

### V4-C · 8.5–12.0 · "The sealed door" (faces ≤ 100, fills 1)
* **In.** Whip-pan left with smear: `camBegin(960 − 660·easeOut(seg(t, 8.5, 9.3)), 540, 1)` over a cel-3D wide
  `cam3({ pos: [−10, 3, 18], look: [−14, 3, −6], fov: 44 })`, with `motionStreaks` on the pan and `flash(.25·(1 − seg(t, 8.5, 8.8)), PAL.cream)`.
  Light `[.3, .6, −.5]` (the door is in shade).
* **On screen.** The plaza edge and the sealed chamber door (12 faces) set into the hill; the glyph is a 2D decal on
  the door's named quad (`violet` `inkLine` polygon); **1 `fill`** shade pool around the door. At 10.5 the glyph
  pulses once: `glow(gx, gy, 90·pulse(t, 3), PAL.violet, .8)` for two beats, then dims. Hold.
* **EVENT.** The glyph pulse — the side quest's hook.
* **Reads.** 8.5–10.5 the sealed door (pan, then still) · 10.5–12.0 the glyph pulse, hold.
* **Out.** `iris(gx, gy, lerp(1500, 3, easeIn(seg(t, 11.4, 12.0))))` shut on the glyph.

---

## Per-video asset checklist (what `cast.js` / `props.js` must contain before a shot can be written)

| asset | V1 | V2 | V3 | V4 | site |
|---|---|---|---|---|---|
| K-01 mesh JSON (14 parts) + poses rest / crouch / launch / flight / landing / parked | ● | ● | ● | ● | ● |
| Gantry + cradle mesh | ● | ● | | | ● |
| Tunnel ring + blast doors mesh | ● | | ● | | ● |
| Island low-poly mesh + sealed door mesh | ● | | | ● | ● |
| Unit-7 mesh + face decal | ● | ● | | | ● |
| Pilot: 5 views × {calm, resolve, strain, joy, curious}, `coat` flag, hooks armL/armR | ● | ● | | ● | |
| Bit: 3 views × {neutral, excited, alert}, scan-lamp prop | ● | ● | | ● | |
| Nell / Mo / Ash: front × {neutral, wave} | | | | ● | |
| 2D: tile-wave painter, HUD rings, thruster ribbon, dust ring, lamp billboard, cloud bank, streak field | ● | ● | ● | ● | |

Render order of work: V1 first (contact sheets per shot, strips across every seam and both impact frames), then
V3, V2, V4. Encode per DESIGN §7; posters at 20.5 / 3.6 / 4.8 / 7.5 s.
