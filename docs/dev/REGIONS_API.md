# REGIONS_API: building a region for "Yichen's World" (round 4)

This documents `assets/js/game3d/regions.js` exactly as it is implemented. A region is one file,
`assets/js/game3d/regions/<id>.js`, that **default-exports a definition**. Nothing else in the repo needs
to change: hub doors, the map, the boat, travel, save data, the minimap, the HUD tracker, Field Notes
and the Quest log already know every region id. The complete working example is
`assets/js/game3d/regions/sandbox.js`; copy it to start.

Rules for region packages:
- Edit only your own `regions/<id>.js` (and optionally `regions/art-<id>.js` for sprite grids). Never
  edit `three/art.js` or any shared file: register sprites at build time with `registerArt`.
- Import everything from `'../regions.js'` (and, if you need them, the bus `'../bus.js'`).
- Facts: only the allowed facts in GAME_SPEC.md; jokes must read as jokes; original characters only;
  real people other than Yichen and Zhuo appear in text only, never as characters.
- Region-only code runs lazily (the module is fetched the first time someone travels there), so a bug
  in one region cannot break the page, the hub or other regions. `build()` errors are caught and logged.

## 1. Testing your region

- `http://localhost:8000/?force=1&dpr=1&intro=0&lowfx=1&region=<id>`: loads the page, enters play and
  travels straight into your region (spawn point). Add `&webgl=1` on the software-GPU test machine: it
  renders ~50× faster than WebGPU there.
- Console: `__g.travel('<id>')`, `__g.travel('hub')`, `__g.where` (current id + origin),
  `__g.sim(seconds)` runs the play simulation at 60 Hz without rendering (use with
  `page.keyboard.down('KeyW')` in Playwright), `__g.player`, `__g.foes`, `__g.patternBosses`,
  `__g.S.world` (save data), `__g.closeAllModals()`.
- Lint: `eslint -c $S/eslint.config.mjs assets/js`.

## 2. The definition

```js
export default {
  id: 'tsinghua',                        // must be one of the ids in REGIONS below
  name: 'Tsinghua University',           // map / banner / zone fallback name
  subtitle: '自强不息，厚德载物',          // optional: shown under the name when you arrive
  size: 48,                              // island width in cells (32–56); used by the minimap and flight bounds
  spawn: [0, 18],                        // local [x, z] where travellers arrive (default [0, 0]); keep it walkable
  bound: 64,                             // optional: flight soft-bound radius (default size / 2 + 40)
  sky: { tint, ground, fog, density, background, sun },  // optional, see setSky; applied on arrival
  zones: { pond: { x: -10, z: 4, r: 6, label: '荷塘 · Lotus pond' } },   // named areas: HUD zone title
  build(ctx) { /* called once, the first time anyone travels here */ },
  onEnter(ctx) { /* every arrival */ },
  onLeave(ctx) { /* every departure */ },
};
```

`registerRegion(def)` also exists (the default export is registered for you). `origin` is **not**
yours to choose: it comes from the `REGIONS` table so the map and doors agree before your code loads.

### Region ids, origins and hub doors (`REGIONS` in regions.js)

| id | origin (world x, z) | hub door |
|---|---|---|
| tsinghua | 400, 0 | Tsinghua Second Gate: walk through the centre arch (or E) |
| picasso | 800, 0 | CSE building front door (E) |
| metabit | 0, 400 | Metabit flag on the trail (E) |
| timi | 400, 400 | Tencent · TiMi flag (E) |
| hotstar | 800, 400 | Disney+ Hotstar flag (E) |
| lark | 1200, 400 | ByteDance · Lark flag (E) |
| starry | 0, 800 | Starry-Next monolith (E) |
| im | 400, 800 | IM System speech bubbles (E) |
| oj | 800, 800 | CST-OJ judge (E) |
| triton | 1200, 800 | King Triton statue (E) |
| stacks | 0, -400 | Geisel Library entrance (E) |
| finale | 400, -400 | none on the hub: reach it from the Stacks with `portal(ctx, { to: 'finale' })` |
| sandbox | -400, 400 | none (developer only, `?region=sandbox`) |

The Scripps pier boat (hub) and the world map (M) list every **discovered** region. A region becomes
discovered the first time the player arrives. Every region must place a portal back to the hub.

## 3. Coordinates

All helpers take **region-local x, z** (relative to the origin; the island is centred on 0, 0) and
**absolute y**. Ground heights are integers (top voxel y); use roughly 1–8 for ground (the hub's is 2–4).
Anything that falls below world y = -16 is caught and returned to your `spawn` gently (no damage), so
never build walkable ground below about y = -10. Handles that return world coordinates say so.

## 4. The build context `ctx`

| field | meaning |
|---|---|
| `ctx.id`, `ctx.def` | region id and definition |
| `ctx.group` | THREE.Group holding everything the region shows (hidden while you are elsewhere). It is at the world origin: helpers already offset by the region origin. If you add raw THREE objects, position them at `x + ctx.ox, y, z + ctx.oz`. |
| `ctx.ox`, `ctx.oz`, `ctx.origin` | the region origin in world coordinates |
| `ctx.toWorld(x, z)` / `ctx.toLocal(x, z)` | coordinate conversion, returns `[x, z]` |
| `ctx.rand()` | deterministic PRNG seeded by the region id (0..1) |
| `ctx.state` | **persistent** plain object for this region (saved in localStorage with the game save). Call `ctx.save()` after changing it. |
| `ctx.player` | read-only view of the player in local coordinates: `x, z, y, dead, vehicle` |
| `ctx.heightAt(x, z)`, `ctx.surfaceY(x, z)` | ground top voxel y (or `-Infinity`), and `+0.5` (where feet stand) |
| `ctx.world` | the composite world (world-coordinate API: `height, surfaceY, walkable, isBlocked, block, unblock, typeAt, zoneAt`) |
| `ctx.live`, `ctx.playing` | the player is in this region; play mode (vs. the page's tour mode) |

## 5. API reference (all exported from `regions.js`)

### Terrain and scenery

**`terrain(ctx, { size, height, type, palette, skirt = 6, cx = 0, cz = 0, shadow = true })`** → `{ height(x,z), typeAt(x,z), block(x,z), unblock(x,z), mesh, size }`
- `height(x, z)` (local, integers) → top voxel y, or `null`/non-finite for no ground (void/sea).
- `type(x, z)` → a key of `palette`; `palette: { key: ['#hex', …] }` colours are mixed per voxel.
- A `size × size` instanced voxel heightmap centred on local `(cx, cz)`. Registers collision, the minimap
  colours (first colour of each key) and `def.zones` names into the composite world. Walking climbs
  1-block steps automatically; 2-block ledges need a jump; 3+ are walls.
- May be called several times (separate islands, raised floors). Where grids overlap the higher wins.

**`props(ctx, cells, { block = false, shadow = true, roughness, metalness })`** → InstancedMesh
- `cells: [[x, y, z, '#colour', glow?], …]` local x/z, absolute y (one voxel each; glow = emissive multiplier).
- `block: true` marks every column a cell covers as solid. `mesh.userData.setHi(0..1)` lights it up.
- Cell helpers re-exported from props.js: `boxCells(x0, x1, y0, y1, z0, z1, colour, { hollow, glow, pick(x,y,z) })`,
  `ringCells(cx, cz, hw, y, colour | (x,z)=>colour, { glow })`, `shade(hex, amount)`, `hash3(x, y, z)`.

**`block(ctx, x, z)` / `unblock(ctx, x, z)`**: mark a local cell solid / clear it.

**`scatter(ctx, spriteName, [{ x, z, y?, rotY?, scale? = 0.2 }], { glow, maxHalf = 2, shadow = false })`** → InstancedMesh
- Many static copies of one sprite in one draw call (trees, grass, crates). `y` defaults to the ground.

**`sprite(ctx, name, { x, z, y?, scale = 0.2, face = 0, glow })`** → THREE.Group (animated voxel sprite; world position). `g.userData.setFrame(i)`.

**`platform(ctx, { x, z, w = 3, d = 3, y = 3, color, glow = 0, thick = 1, move?: (t, handle) => y })`** → `{ mesh, y, off }`
- A box you can stand on; `y` is its top (feet height). `move(t)` (seconds) returns the top every frame
  (elevators, candlesticks, memory tiers). Set `handle.y` yourself, or `handle.off = true` to remove it
  from collision (and hide it). Only vertical motion carries the player.

**`registerArt(name, { pal, frames }, glow?)`**: add a sprite grid (see §7). Returns `name`.

### Enemies and bosses

**`registerEnemyKind(id, def)`**. `def`:

| field | default | meaning |
|---|---|---|
| `name` | id | shown in combat text / game over |
| `sprite` or `art` | id | a sprite name, or an inline grid registered under `sprite \|\| id` |
| `hp, speed, dmg` | 30, 3.5, 8 | scaled up gently with the player's level |
| `type` | 'Normal' | companion type matchups: Fire, Water, Electric, Grass, Ice, Flying, Ghost, Dark, Dragon, Psychic, Normal |
| `xp, gold` | 20, 25 | reward per kill |
| `behaviour` | 'chase' | `'chase'` (wander, chase inside aggro, give up past leash), `'wander'` (harmless ambient life), `'ranged'` (keeps ~6 away, shoots), `'charge'` (telegraphs 0.6 s, dashes), `'swarm'` (fast, circles and darts in), `'turret'` (static, shoots) |
| `aggro, leash` | 7, 12 | ranges |
| `flying` | false | hovers 2.2 above ground |
| `scale` | 0.2 | voxel size (0.2 ≈ the islanders) |
| `rate` | 2200 | ms between shots (ranged/turret) and charges |
| `proj, projSpeed` | 'orb', 8 | projectile look: `orb, fireball, dragonfire, spark, ember, bubble, pulse, star, psy` |
| `burst` | false | turrets fire three |
| `respawn` | 15000 | ms, or `false` for never |
| `color, glow` | | death burst colour; glow `{ paletteKey: intensity }` for inline art |

Built-in kinds you may reuse: `slime-green` (Off-by-one Slime), `slime-red` (NaN Slime), `bat`
(Seagull), `skeleton` (Legacy Code), `slime-dark` (Null Pointer).

**`spawnEnemy(ctx, { kind, x, z, ...overrides })`** → Foe. Any kind field can be overridden per spawn, plus
`onDeath(foe)`. Foe: `x, z` (**world**), `y, hp, maxHp, alive, name, kind, region`, `knock(dx, dz, power)`,
`remove()`. Foes only update, show and can be targeted while their region is live and never hurt
anyone outside play mode. Knockback from the melee combo is automatic.

**`spawnBoss(ctx, cfg)`** → PatternBoss. `cfg`:

| field | default | meaning |
|---|---|---|
| `id` | required | unique; kills are saved in `S.world.bossKills[id]` |
| `name` | id | HUD boss bar title |
| `x, z` | | local home |
| `sprite` or `art`, `scale` | id, 0.34 | look (existing: `golem, mage, dragon`, or your art) |
| `hp, type, r` | 200, 'Normal', 1.6 | |
| `pattern` | 'fan' | `'rings'` (frost fields that arm after 0.7 s), `'fan'` (fan of slow orbs), `'volley'` (aimed fireballs 1-3-5), `'nova'` (12 orbs all round), `'summon'` (2–3 minions of `minion`, max 4 alive), `'charge'` (telegraphed dash + shockwave), or an array cycled in order |
| `every` | per pattern | ms between attacks (overrides the pattern's own cadence) |
| `phases` | [] | `[{ below: 0.5, pattern, every, speed }]`: switch when HP ≤ that fraction |
| `move` | 'lumber' | `'lumber'` (walks at you), `'hover'` (sways at home), `'blink'` (teleports every 5 s), `'static'` |
| `speed, aggro, contact` | 1.4, 13, 12 | move speed, engage range, contact/projectile damage |
| `color, minion, flying` | | ring/burst colour, summon kind, hover 2 up |
| `reward` | { gold: 300, xp: 80 } | |
| `drop` | | Road to Dr. item id awarded on the **first** defeat (see award) |
| `respawn` | 30000 | ms until it returns, or `false` (stays beaten) |
| `onDefeat(boss, { first })` | | your hook |

Boss: `alive, defeated` (ever beaten), `hp, maxHp, enraged` (HP < 50 %, faster, more projectiles).
It shows the HUD boss bar while engaged. Hazards clear when a dialog opens (the world pauses).

### People and things

**`spawnNpc(ctx, { id, name, sprite | art, x, z, face = 0, scale = 0.2, talk: () => node, news?: () => bool })`** → npc
- `id` must be unique across the whole game (prefix with your region id). E or clicking the name plate
  talks; `say(id, text)` speaks in a bubble; `news()` true shows the "!" mark.
- Dialog node: `{ text, note?, choices: [{ label, icon?, next?: node | () => node, action?: () => void }] }`.
  A choice with neither `next` nor `action` closes the dialog. `action` runs, then the dialog closes
  (open another modal from it and the world stays paused). Keys 1–9 pick choices. Icons: file names in
  `assets/icons/game` or `assets/icons/ui` (e.g. `scroll-text`, `crossed-swords`, `ribbon-medal`).

**`interactable(ctx, { x, z, r = 2.2, label, prompt = 'E · use', onInteract(handle), once = false, y?, plateY = 2.6, sprite?, spriteScale = 0.2, face = 0, see = 6 })`** → handle
- Signs, chests, computers, bikes, plaques. A name plate (visible in play mode within r+`see`) shows
  `label`; inside `r` it shows `prompt` and E / the touch E button calls `onInteract`. When an NPC and an
  interactable are both in reach, the relatively nearer one wins.
- handle: `x, z` (local), `enabled`, `label`, `prompt`, `setLabel(t)`, `setPrompt(t)`, `remove()`, `mesh`.

**`dialog(node, { name, sprite })`**: open a dialog without an NPC (signs, terminals, cutscene text).

**`trigger(ctx, { x, z, r = 2, w?, d?, onEnter(handle), onLeave?(handle), once = false, playOnly = true, minY?, maxY? })`** → `{ remove(), inside, enabled }`
- Fires when the player walks in (circle of radius `r`, or a `w × d` rectangle). `minY/maxY` limit it
  to a height band (e.g. only on a rooftop). With `playOnly: false` it also fires in tour mode (the
  page's walking scholar); leave it `true` for gameplay.

**`pickup(ctx, { x, z, id?, sprite = 'token', scale = 0.16, y?, onPick(handle), respawn? })`** → `{ remove(), taken }`
- Floating, spinning collectible, collected on contact. With an `id` it stays collected forever
  (`ctx.state.picked[id]`). `respawn` (ms) brings it back instead.

**`portal(ctx, { x, z, to = 'hub', at?, label?, color = '#a78bfa', face = 0 })`** → `{ mesh, trigger, remove() }`
- A glowing voxel arch; walking through its centre travels. `at`: arrival `[x, z]`, local to the target
  region (world coordinates when `to` is `'hub'`); omit it to arrive at the target's spawn. Portals arm
  only after you step away from them, so arriving on one never bounces you back.

**`travel(to, at?)`**: travel from code (cutscenes, puzzles). Returns a Promise<boolean>.

**`ride({ name = 'Bike', speed = 1.6 })` / `dismount()`**: a temporary mount that multiplies walking speed
(bikes, carts). It ends on `dismount()`, on travel, or when the player presses E with nothing to use.
(The engine's own vehicles, on V, are separate and always available.)

### Quests, the Road to Dr., eggs

**`quest(def)`** (alias **`registerQuest(def)`**): `{ id, title, region?, steps: [{ id, text, done: () => bool }], reward: { gold, xp, item }, hidden }`
- Steps are polled twice a second in play. The HUD tracker shows your region's open quests (next step)
  under the Road to Dr.; the Quest log (L) lists all. When every step is done the reward is paid once
  (`S.world.quests[id] = 'done'`), with a toast; `item` may be a Road item id. `region` defaults to yours.

**`award(itemId)`** → true the first time. **`hasItem(itemId)`**. **`ROAD`** (the list).
Road to Dr. item ids (each region owns exactly its own):

| region | item id | kind |
|---|---|---|
| tsinghua | `diploma` | Diploma |
| picasso / metabit / timi / hotstar / lark | `badge-picasso`, `badge-metabit`, `badge-timi`, `badge-hotstar`, `badge-lark` | Badge |
| starry / im / oj / triton | `relic-starry`, `relic-im`, `relic-oj`, `relic-triton` | Relic |
| stacks | `seal-tritongym` ("Under review"), `seal-reh2o` ("Published IEEE IV 2023") | Seal |

Awarding shows a banner and updates the HUD, map and trophy board. When all thirteen are held the bus
emits `'road:complete'` (the finale package listens for it; `roadComplete()` lives in road.js).

**`egg(id, name, hint, done)`** → `find(opts?)`
- Registers a game egg (kind `'game'`, grouped under your region in Field Notes; idempotent; ids are
  global, so prefix them). Call the returned function (or `found(id, { say })`) when it is found;
  `say` overrides the toast subtitle. Aim for ≥ 6 eggs per region, each tied to a real CV fact or a
  clearly-joke bit of academic culture.

### Talking, feedback, sky, camera

- **`say(who, text, ms = 5200)`**: speech bubble over `'me'` (the scholar), `'bit'` (the companion), an NPC id or NPC object.
- **`banner(title, sub?, icon?)`**: big centre-screen title. **`toast(text, { icon, tone: 'good' | 'gold' | 'bad' })`**.
- **`sfx(name)`**: `coin, swing, hit, hurt, block, kill, crit, fireball, heal, zap, meteor, boom, buddy, signature, levelup, achievement, victory, purchase, open, error, rune, door, encounter, stamp, flip, tick, pop, warp, ring, squeak, jump, slash, slash3, honk, thrust, vehicle, portal`.
- **`setSky({ tint = '#c7d2fe', ground = '#0b1024', fog = '#070a12', density = 0.0085, background = fog, sun = 2.2 })`**: hemisphere sky / ground colours, fog colour and density, background, sun intensity. `def.sky` is applied on arrival and the hub restores the night default. Night stays the house mood.
- **`cinematic(ctx, { x, y, z, yaw?, pitch = 0.4, dist = 18, seconds = 2.5 })`**: hold the play camera on a point (boss intros, cutscenes); input look is ignored meanwhile.
- **`unlockGlider()`**: gives the Torrey Pines glider (hold Space while falling). The hub summit gives it too.

### Per-frame and lifecycle

- **`onUpdate(ctx, (dt, t) => {})`** → unsubscribe. Runs every frame while your region is live (play and
  tour; paused while a dialog is open in play). `dt` seconds, `t` seconds (wall clock).
- **`onEnter(ctx, fn(ctx))`**, **`onLeave(ctx, fn(ctx))`**: in addition to `def.onEnter/onLeave`.
- Bus events you can `on(...)` from `'../bus.js'`: `'kill' { target, source }`, `'boss:defeated' { id, name, region, first }`,
  `'road:item' { id, item, count }`, `'road:complete'`, `'quest:done' id`, `'travel' { from, to, via }`,
  `'npc:talk' { id, region }`, `'player:jump'`, `'player:dodge'`, `'player:land' impact`, `'player:swing' step`,
  `'vehicle' id`, `'ride' name`, `'egg' id`, `'glider'`.

## 6. What the engine gives every region for free

Mouse-look third/first-person camera with terrain/obstacle collision; movement (coyote time, jump
buffer, variable jump, 1-block auto step, sprint, dodge with i-frames, glide); the 3-hit sword combo
with hit-stop and knockback; spells 1–4; the companion (follows, fights, is teleported with you);
vehicles on V (flying sword, Mk-35 Triton exosuit, sports car; flight is bounded by `bound` and a
ceiling at y 64); touch controls on phones; the HUD (zone name from `zones`, boss bar, minimap of
your terrain, tracker); drops and XP from kills; gentle respawn at your `spawn` (falls and deaths cost
nothing); save data; Field Notes; the map and boat.

## 7. Sprites

A sprite is `{ pal: { char: '#hex' }, frames: [[row strings], …] }`: every row of every frame the
same width, `'.'` transparent, dark palette colours inside the silhouette become front-only details
(eyes). Two frames give a walk/idle cycle. Keep them original (no borrowed IP). Put big grids in
`regions/art-<id>.js`:

```js
// regions/art-lark.js
export const LARK_ART = { 'lark-queue': { pal: {...}, frames: [[...], [...]] } };
// regions/lark.js
import { LARK_ART } from './art-lark.js';
build(ctx) { for (const [name, art] of Object.entries(LARK_ART)) registerArt(name, art); ... }
```

Built-in sprite names: scholar, bit, book, crystal, slime, bat, skeleton, golem, mage, dragon, chest,
chest-open, sparkit, voltrix, emberling, pyrelion, tidefin, wyrmlet, oracle, triton, sungod, sealion,
paraglider, hat, owl, robot, merchant, frog, sprout, chef, cartographer, token, grass, door; variants
seagull, slime-green, slime-red, slime-dark.

## 8. Performance rules

- Build terrain with **one** `terrain()` call where you can (one draw call) and props as a few big
  `props()` cell lists rather than hundreds of small ones. Use `scatter()` for repeated sprites.
- Every `sprite()`, NPC, enemy and pickup is its own draw call: keep a region under ~40 of them.
- `onUpdate` runs every frame: no DOM work, no allocations in hot loops.
- Keep `size` ≤ 56 (≈ 3k columns).

## 9. Complete example (regions/sandbox.js)

The file in the repo is the reference; abridged:

```js
import {
  terrain, props, block, scatter, sprite, platform, registerEnemyKind, spawnEnemy, spawnBoss, spawnNpc,
  interactable, trigger, pickup, portal, quest, egg, say, banner, toast, sfx, setSky, onUpdate, onEnter,
  cinematic, ride, dismount, dialog, boxCells,
} from '../regions.js';

const FLOPPY = { pal: { B: '#2563eb', b: '#1e3a8a', L: '#e5e7eb', S: '#94a3b8', e: '#0b1020' }, frames: [[/* 8 rows */], [/* 8 rows */]] };

export default {
  id: 'sandbox', name: 'Sandbox', size: 44, spawn: [0, 14],
  sky: { tint: '#bfdbfe', ground: '#10223f', fog: '#0a1428', density: 0.007, sun: 2.4 },
  zones: { steps: { x: -12, z: 4, r: 7, label: 'Step test' }, arena: { x: 8, z: -10, r: 9, label: 'Boss pit' } },
  build(ctx) {
    terrain(ctx, {
      size: 44,
      height: (x, z) => (Math.hypot(x, z) > 20 ? null : Math.hypot(x - 8, z + 10) < 8 ? 1 : 3),
      type: (x, z) => (Math.hypot(x - 8, z + 10) < 8 ? 'sand' : 'grass'),
      palette: { grass: ['#4fb56b', '#3f9d5a'], sand: ['#d9c58a', '#c9b478'] },
    });
    props(ctx, boxCells(-4, 4, 4, 6, -2, -2, '#475569'), { block: true });
    platform(ctx, { x: 16, z: 0, y: 4, color: '#a78bfa', move: (t) => 4 + 3 * (0.5 + 0.5 * Math.sin(t * 0.8)) });

    registerEnemyKind('floppy', { name: 'Floppy Disk', art: FLOPPY, hp: 24, speed: 4.2, dmg: 6, behaviour: 'swarm' });
    spawnEnemy(ctx, { kind: 'floppy', x: -3, z: 2 });
    const boss = spawnBoss(ctx, {
      id: 'sandbox-golem', name: 'Test Golem', sprite: 'golem', x: 8, z: -11, hp: 160, type: 'Ice',
      pattern: ['rings', 'fan'], phases: [{ below: 0.5, pattern: ['summon', 'nova', 'charge'] }], minion: 'floppy',
      respawn: 20000, onDefeat: () => findBoss(),        // a real region would add drop: 'relic-oj' etc.
    });

    spawnNpc(ctx, {
      id: 'sandbox-bot', name: 'Test Bot', sprite: 'robot', x: 4, z: 12,
      talk: () => ({ text: 'Beep.', choices: [
        { label: 'Branch', next: () => ({ text: 'Nested node.', choices: [{ label: 'Neat' }] }) },
        { label: 'Show me the boss', action: () => cinematic(ctx, { x: 8, y: 3, z: -11, dist: 20 }) },
        { label: 'Bye' },
      ] }),
    });
    interactable(ctx, { x: -2, z: 14, label: 'Sign', prompt: 'E · read', onInteract: () => dialog({ text: 'Hello.', choices: [{ label: 'OK' }] }, { name: 'Sign', sprite: 'book' }) });
    interactable(ctx, { x: 6, z: 15, label: 'Bicycle', prompt: 'E · ride', onInteract: () => ride({ name: 'Bicycle', speed: 1.7 }) });
    trigger(ctx, { x: 8, z: -10, r: 7, once: true, onEnter: () => toast('The pit.') });
    pickup(ctx, { id: 'sandbox-token', x: -15, z: 5, onPick: () => { ctx.state.token = true; ctx.save(); } });
    portal(ctx, { x: 0, z: 18, to: 'hub' });

    quest({ id: 'sandbox-tour', title: 'Sandbox tour', reward: { gold: 50, xp: 20 }, steps: [
      { id: 'token', text: 'Pick up the token', done: () => !!ctx.state.token },
      { id: 'boss', text: 'Beat the Test Golem', done: () => boss.defeated },
    ] });
    const findBoss = egg('sandbox-golem', 'Green CI', 'Beat the sandbox golem.', 'Coverage: 100% (of one golem).');

    onUpdate(ctx, (dt, t) => { /* animate things */ });
    onEnter(ctx, () => say('bit', 'A sandbox!'));
  },
};
```

## Known limitation
A dialog choice whose `action` opens another `dialog()` gets closed right after the action runs (npcs.js closes the "dialog" modal). Chain dialogs with `next` instead.
