// Regions: the places in Yichen's CV, each a separate voxel island far from the UCSD hub, entered
// through doors on the hub (see travel.js). A region is a plain module, regions/<id>.js, that exports
// (default) a definition; it is fetched and built the first time someone travels there, then kept.
//
//   export default {
//     id: 'tsinghua', name: 'Tsinghua University', size: 48,
//     spawn: [0, 18],                        // local x, z where travellers arrive (default [0, 0])
//     sky: { tint: '#c7d2fe', ground: '#0b1024', fog: '#070a12', density: 0.0085 },
//     zones: { pond: { x: -10, z: 4, r: 6, label: '荷塘 · Lotus pond' } },
//     build(ctx) { terrain(ctx, {...}); spawnNpc(ctx, {...}); ... },
//     onEnter(ctx) {}, onLeave(ctx) {},
//   };
//
// Every helper takes the build context first and works in REGION-LOCAL coordinates (x, z relative to
// the region origin; y is absolute world height, ground usually 1-6). Handles returned by helpers
// expose world coordinates where noted. See REGIONS_API.md (scratchpad) for the full reference.
import * as THREE from 'three/webgpu';
import { S, save } from './state.js';
import { emit } from './bus.js';
import { mode } from './mode.js';
import { where } from './where.js';
import { cellSet } from './worldgrid.js';
import { voxBuild, boxCells, ringCells, hash3, shade } from './props.js';
import { makeActor, registerArt, mergeSprites } from './actors.js';
import { Foe, PatternBoss, KINDS, registerEnemyKind as regKind } from './foes.js';
import { addNpc, npcs, talk } from './npcs.js';
import { player } from './player.js';
import { registerQuest as regQuest, award, hasItem, ROAD } from './road.js';
import { registerEgg, found } from '../site/eggs.js';
import { toast as gameToast, banner as gameBanner } from './notify.js';
import { sfx as gameSfx } from './audio.js';
import { h } from './util.js';
import * as fx from './fx.js';

// Where each region lives (origin on a 400-unit grid) and what the map calls it. Regions may override
// `name`, never `origin` (so the map and doors agree before a region's code is loaded).
export const REGIONS = {
  tsinghua: { name: 'Tsinghua University', origin: [400, 0], door: 'The Second Gate (walk through the arch)' },
  picasso: { name: 'Picasso Lab', origin: [800, 0], door: 'The CSE building’s front door' },
  metabit: { name: 'Metabit trading floor', origin: [0, 400], door: 'The Metabit flag on the trail' },
  timi: { name: 'TiMi hunting grounds', origin: [400, 400], door: 'The TiMi Studio flag on the trail' },
  hotstar: { name: 'Hotstar stadium', origin: [800, 400], door: 'The Disney+ Hotstar flag on the trail' },
  lark: { name: 'Lark tower', origin: [1200, 400], door: 'The Lark flag on the trail' },
  samsung: { name: 'Samsung agent fab', origin: [1600, 400], door: 'The Samsung flag on the trail' },
  starry: { name: 'Starry-Next kernel', origin: [0, 800], door: 'The Starry-Next monolith' },
  im: { name: 'IM chat maze', origin: [400, 800], door: 'The IM System speech bubbles' },
  oj: { name: 'CST-OJ tower', origin: [800, 800], door: 'The online judge' },
  triton: { name: 'TritonGym arena', origin: [1200, 800], door: 'King Triton’s statue' },
  stacks: { name: 'Geisel Stacks', origin: [0, -400], door: 'Geisel Library’s entrance' },
  finale: { name: 'The Defense', origin: [400, -400], door: 'Deep in the Stacks, once all thirteen are collected' },
  sandbox: { name: 'Sandbox', origin: [-400, 400], door: 'Developers only (?region=sandbox)' },
};

const defs = {};        // id -> registered definition
const built = {};       // id -> ctx
const loading = {};     // id -> Promise<ctx>
let env = null;         // { scene, world, root } from index.js
let building = null;    // ctx of the region being built (eggs register into it)

export function initRegions(e) { env = e; }
export const regionDef = (id) => defs[id] || null;
export const regionName = (id) => (id === 'hub' ? 'UC San Diego' : defs[id]?.name || REGIONS[id]?.name || id);
export const builtRegion = (id) => built[id] || null;

/** Register a region definition (a region module's default export is registered automatically). */
export function registerRegion(def) {
  if (!def?.id || typeof def.build !== 'function') throw new Error('registerRegion: id and build(ctx) are required');
  defs[def.id] = { size: 48, spawn: [0, 0], ...def, origin: REGIONS[def.id]?.origin || def.origin || [0, 0] };
  if (!defs[def.id].origin) throw new Error(`registerRegion: no origin for ${def.id}`);
  return defs[def.id];
}

/** Load (once) and build (once) a region. Resolves to its ctx, or null when the module is missing. */
export function ensureRegion(id) {
  if (built[id]) return Promise.resolve(built[id]);
  if (loading[id]) return loading[id];
  loading[id] = (async () => {
    if (!defs[id]) {
      try {
        const mod = await import(`./regions/${id}.js`);
        if (!defs[id] && mod.default) registerRegion(mod.default);
      } catch (err) {
        console.warn(`[regions] ${id} is not available yet:`, err?.message || err);
        delete loading[id];
        return null;
      }
    }
    if (!defs[id]) { delete loading[id]; return null; }
    return build(defs[id]);
  })();
  return loading[id];
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

function build(def) {
  const [ox, oz] = def.origin;
  const group = new THREE.Group();
  group.name = `region:${def.id}`;
  group.visible = where.id === def.id;
  env.scene.add(group);
  if (!S.world.data[def.id]) S.world.data[def.id] = {};
  const ctx = makeCtx(def.id, def, group, ox, oz);
  built[def.id] = ctx;
  building = ctx;
  try { def.build(ctx); } catch (err) { console.error(`[regions] ${def.id}.build failed:`, err); }
  building = null;
  delete loading[def.id];
  emit('region:built', def.id);
  return ctx;
}

/** The context handed to build(ctx) (and to every helper). Also used for the hub (id 'hub'). */
export function makeCtx(id, def, group, ox, oz) {
  const ctx = {
    id, def, group, ox, oz, origin: [ox, oz],
    get world() { return env.world; },
    rand: mulberry(seedOf(id)),
    /** Persistent per-region save object (survives reloads). */
    get state() { if (!S.world.data[id]) S.world.data[id] = {}; return S.world.data[id]; },
    save,
    toWorld: (x, z) => [x + ox, z + oz],
    toLocal: (x, z) => [x - ox, z - oz],
    /** The player in local coordinates (read-only view). */
    player: { get x() { return player.x - ox; }, get z() { return player.z - oz; }, get y() { return player.y; }, get dead() { return player.dead; }, get vehicle() { return player.vehicle; } },
    /** Ground under a local point: top voxel y (or -Infinity). */
    heightAt: (x, z) => env.world.height(x + ox, z + oz),
    surfaceY: (x, z) => env.world.surfaceY(x + ox, z + oz),
    updaters: [], enterFns: [], leaveFns: [],
    get live() { return where.id === id; },
    get playing() { return mode.play; },
  };
  return ctx;
}

// ================================================================ per-frame + lifecycle hooks
/** fn(dt, t) every frame while this region is live (play or tour). Returns an unsubscribe function. */
export function onUpdate(ctx, fn) { ctx.updaters.push(fn); return () => { const i = ctx.updaters.indexOf(fn); if (i >= 0) ctx.updaters.splice(i, 1); }; }
export function onEnter(ctx, fn) { ctx.enterFns.push(fn); }
export function onLeave(ctx, fn) { ctx.leaveFns.push(fn); }

// ================================================================ terrain
/**
 * terrain(ctx, { size, height(x, z) -> int | null, type(x, z) -> palette key, palette: { key: [colours] },
 *                skirt = 6, cx = 0, cz = 0 })
 * An instanced voxel heightmap centred on local (cx, cz), `size` cells square. height() returns the top
 * voxel y (integers, ground is usually 1-6) or null for no ground (sea / void). type() picks a palette
 * key per column; each column mixes that key's colours. Returns { height(x,z), typeAt(x,z), block(x,z),
 * unblock(x,z), mesh }. Collision, enemies, the camera and the minimap all read it automatically.
 * Call it more than once for separate islands; where grids overlap the higher ground wins.
 */
export function terrain(ctx, { size = ctx.def?.size || 48, height, type = () => 'ground', palette = { ground: ['#4fb56b', '#3f9d5a'] }, skirt = 6, cx = 0, cz = 0, shadow = true } = {}) {
  const half = Math.floor(size / 2);
  const keys = Object.keys(palette);
  const H = new Int16Array(size * size).fill(-999);
  const T = new Uint8Array(size * size);
  const idx = (x, z) => (z - cz + half) * size + (x - cx + half);
  const inside = (x, z) => x - cx >= -half && x - cx < size - half && z - cz >= -half && z - cz < size - half;
  for (let z = cz - half; z < cz + size - half; z++) for (let x = cx - half; x < cx + size - half; x++) {
    const hh = height(x, z);
    if (hh == null || !Number.isFinite(hh)) continue;
    H[idx(x, z)] = Math.round(hh);
    const k = keys.indexOf(type(x, z));
    T[idx(x, z)] = (k < 0 ? 0 : k) + 1;
  }
  const hAt = (x, z) => { const xi = Math.round(x), zi = Math.round(z); if (!inside(xi, zi)) return -Infinity; const v = H[idx(xi, zi)]; return v === -999 ? -Infinity : v; };
  // mesh: the top voxel in the column's colour, the exposed sides below it
  const cells = [];
  const col = new THREE.Color();
  for (let z = cz - half; z < cz + size - half; z++) for (let x = cx - half; x < cx + size - half; x++) {
    const hh = H[idx(x, z)];
    if (hh === -999) continue;
    const pal = palette[keys[T[idx(x, z)] - 1]] || ['#888'];
    let low = hh;
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      const nh = hAt(nx, nz);
      low = Math.min(low, nh === -Infinity ? hh - skirt : nh + 1);
    }
    for (let y = Math.min(hh, low); y <= hh; y++) {
      const c = pal[Math.floor(hash3(x, y, z) * pal.length)];
      cells.push(x + ctx.ox, y, z + ctx.oz, y === hh ? c : shade(c, -0.28 - (hh - y) * 0.04));
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardNodeMaterial({ roughness: 0.92 }), Math.max(1, cells.length / 4));
  const m = new THREE.Matrix4();
  for (let i = 0; i < cells.length; i += 4) { m.makeTranslation(cells[i], cells[i + 1], cells[i + 2]); mesh.setMatrixAt(i / 4, m); mesh.setColorAt(i / 4, col.set(cells[i + 3])); }
  mesh.count = cells.length / 4;
  mesh.receiveShadow = shadow; mesh.castShadow = shadow;
  ctx.group.add(mesh);
  const blocked = cellSet();
  const zones = ctx.def?.zones || {};
  env.world.addGrid({
    id: `${ctx.id}:terrain`, region: ctx.id,
    x0: ctx.ox + cx - half - 0.5, x1: ctx.ox + cx + size - half - 0.5, z0: ctx.oz + cz - half - 0.5, z1: ctx.oz + cz + size - half - 0.5,
    height: (x, z) => hAt(x - ctx.ox, z - ctx.oz),
    isBlocked: (x, z) => blocked.has(x - ctx.ox, z - ctx.oz),
    block: (x, z) => blocked.add(x - ctx.ox, z - ctx.oz),
    unblock: (x, z) => blocked.delete(x - ctx.ox, z - ctx.oz),
    typeAt: (x, z) => { const xi = Math.round(x - ctx.ox), zi = Math.round(z - ctx.oz); return inside(xi, zi) ? T[idx(xi, zi)] : 0; },
    zoneAt: (x, z) => {
      const lx = x - ctx.ox, lz = z - ctx.oz;
      let best = null, bd = Infinity;
      for (const [k, zn] of Object.entries(zones)) { const d = Math.hypot(lx - zn.x, lz - zn.z); if (d < zn.r && d < bd) { bd = d; best = { key: k, label: zn.label || k }; } }
      return best || { key: ctx.id, label: regionName(ctx.id) };
    },
    colorAt: (x, z) => { const xi = Math.round(x - ctx.ox), zi = Math.round(z - ctx.oz); if (!inside(xi, zi) || H[idx(xi, zi)] === -999) return null; return (palette[keys[T[idx(xi, zi)] - 1]] || ['#888'])[0]; },
  });
  return {
    height: hAt, mesh, size,
    typeAt: (x, z) => { const xi = Math.round(x), zi = Math.round(z); return inside(xi, zi) && T[idx(xi, zi)] ? keys[T[idx(xi, zi)] - 1] : null; },
    block: (x, z) => blocked.add(x, z),
    unblock: (x, z) => blocked.delete(x, z),
  };
}

// ================================================================ props and blocking
/**
 * props(ctx, cells, { block = false, shadow = true, roughness, metalness }) -> InstancedMesh
 * cells: [[x, y, z, '#colour', glow?], ...] in local x/z, absolute y (see props.js boxCells / ringCells).
 * block: true marks every column the prop covers as solid (walls, statues).
 * The mesh has userData.setHi(0..1) to light it up (like the hub landmarks).
 */
export function props(ctx, cells, { block: solid = false, ...opts } = {}) {
  const mesh = voxBuild(cells, opts);
  mesh.position.set(ctx.ox, 0, ctx.oz);
  ctx.group.add(mesh);
  if (solid) for (const c of cells) block(ctx, c[0], c[2]);
  return mesh;
}
/** Mark a local cell as solid (nothing walks into it) / clear it again. */
export function block(ctx, x, z) { env.world.block(x + ctx.ox, z + ctx.oz); }
export function unblock(ctx, x, z) { env.world.unblock(x + ctx.ox, z + ctx.oz); }
/** Many copies of one sprite in a single draw call: [{ x, z, y?, rotY?, scale? }] local; y defaults to the ground. */
export function scatter(ctx, sprite, places, opts = {}) {
  const mesh = mergeSprites(sprite, places.map((p) => ({ x: p.x + ctx.ox, z: p.z + ctx.oz, y: p.y ?? ctx.surfaceY(p.x, p.z), rotY: p.rotY ?? ctx.rand() * 6.28, scale: p.scale ?? 0.2 })), opts);
  ctx.group.add(mesh);
  return mesh;
}
/** One sprite actor (animated voxel sprite) at a local point; returns the THREE.Group (world position). */
export function sprite(ctx, name, { x = 0, z = 0, y = null, scale = 0.2, face = 0, glow = null } = {}) {
  const g = makeActor(name, { scale, glow });
  g.position.set(x + ctx.ox, y ?? ctx.surfaceY(x, z), z + ctx.oz);
  g.rotation.y = face;
  ctx.group.add(g);
  return g;
}

// ================================================================ moving platforms
/**
 * platform(ctx, { x, z, w = 3, d = 3, y, color = '#94a3b8', glow = 0, move: (t, p) -> y }) -> handle
 * A box you can stand on; its top (feet height) is `y`. `move(t)` (seconds) returns the top each frame
 * (candlesticks, elevators, memory tiers). handle.y can also be set directly; handle.off = true removes
 * it from collision; handle.mesh is the voxel box. Only vertical motion carries the player.
 */
export function platform(ctx, { x, z, w = 3, d = 3, y = 3, color = '#94a3b8', glow = 0, thick = 1, move = null } = {}) {
  const cells = [];
  for (let i = 0; i < w; i++) for (let k = 0; k < d; k++) for (let t = 0; t < thick; t++) cells.push([i - (w - 1) / 2, -0.5 - t, k - (d - 1) / 2, (i + k + t) % 2 ? color : shade(color, -0.12), glow]);
  const mesh = voxBuild(cells);
  ctx.group.add(mesh);
  const p = { x0: x + ctx.ox - w / 2, x1: x + ctx.ox + w / 2, z0: z + ctx.oz - d / 2, z1: z + ctx.oz + d / 2, top: y, region: ctx.id, off: false };
  env.world.addPlatform(p);
  const handle = {
    mesh,
    get y() { return p.top; },
    set y(v) { p.top = v; mesh.position.y = v; },
    get off() { return p.off; },
    set off(v) { p.off = !!v; mesh.visible = !v; },
  };
  mesh.position.set(x + ctx.ox, y, z + ctx.oz);
  if (move) onUpdate(ctx, (dt, t) => { handle.y = move(t, handle); });
  return handle;
}

// ================================================================ enemies and bosses
/**
 * registerEnemyKind(id, { name, hp, speed, dmg, type, xp, gold, sprite | art, flying, behaviour,
 *   aggro, leash, scale, rate, proj, projSpeed, respawn, color, glow })
 * behaviour: 'chase' | 'ranged' | 'charge' | 'swarm' | 'turret' | 'wander'. `art` is an inline sprite
 * grid ({ pal, frames }) registered under the kind id. type feeds the companion's type matchups
 * (Fire, Water, Electric, Grass, Ice, Flying, Ghost, Dark, Dragon, Psychic, Normal).
 */
export function registerEnemyKind(id, def) {
  if (def.art) registerArt(def.sprite || id, def.art, def.glow);
  return regKind(id, { ...def, sprite: def.sprite || id });
}
/** spawnEnemy(ctx, { kind, x, z, ...overrides }) -> Foe (foe.x / foe.z are WORLD coordinates). */
export function spawnEnemy(ctx, { kind, x, z, ...over }) {
  if (!KINDS[kind]) throw new Error(`spawnEnemy: unknown kind "${kind}" (registerEnemyKind first)`);
  const [wx, wz] = findGround(ctx, x, z);
  return new Foe(env.world, ctx.group, kind, wx, wz, { region: ctx.id, ...over });
}
/**
 * spawnBoss(ctx, { id, name, x, z, sprite | art, scale, hp, type, pattern, every, phases, move, speed,
 *   aggro, contact, color, minion, reward: { gold, xp }, drop, respawn, onDefeat(boss, { first }) })
 * pattern: 'rings' | 'fan' | 'volley' | 'nova' | 'summon' | 'charge' or an array (cycled).
 * drop: a Road to Dr. item id ('diploma', 'badge-lark', 'relic-oj', 'seal-reh2o'…) awarded on the first
 * defeat. respawn: ms until it returns (default 30000), or false to stay beaten for good.
 * Returns the boss (boss.defeated tells whether it was ever beaten; boss.alive; boss.hp / maxHp).
 */
export function spawnBoss(ctx, { art, drop, onDefeat, x, z, ...cfg }) {
  if (art) registerArt(cfg.sprite || cfg.id, art, cfg.glow);
  const [wx, wz] = findGround(ctx, x, z);
  const boss = new PatternBoss(env.world, ctx.group, {
    sprite: cfg.sprite || cfg.id, ...cfg, x: wx, z: wz, region: ctx.id,
    onDefeat: (b, info) => { if (drop && info.first) award(drop); onDefeat?.(b, info); },
  });
  return boss;
}
function findGround(ctx, x, z) {
  let wx = x + ctx.ox, wz = z + ctx.oz;
  for (let i = 0; i < 24 && (!env.world.walkable(wx, wz) || env.world.isBlocked(wx, wz)); i++) { wx = x + ctx.ox + (ctx.rand() - 0.5) * (2 + i * 0.3); wz = z + ctx.oz + (ctx.rand() - 0.5) * (2 + i * 0.3); }
  return [wx, wz];
}

// ================================================================ NPCs
/**
 * spawnNpc(ctx, { id, name, sprite | art, x, z, face, scale, talk: () => node, news: () => bool })
 * node = { text, note?, choices: [{ label, icon?, next?: node | () => node, action?: () => void }] }
 * (the same dialog format as the hub islanders; a choice without next/action just closes). E talks,
 * clicking the name plate talks, say(id, text) makes it speak. `news` shows the "!" mark.
 */
export function spawnNpc(ctx, { id, name, sprite: sp, art, x, z, face = 0, scale = 0.2, talk: talkFn, news = null }) {
  if (npcs.some((n) => n.id === id)) console.warn(`[regions] duplicate NPC id "${id}"; say(id) will reach the first one`);
  if (art) registerArt(sp || id, art);
  const [wx, wz] = findGround(ctx, x, z);
  return addNpc({ id, cfg: { name, sprite: sp || id, face, scale, talk: talkFn || (() => ({ text: '…', choices: [{ label: 'Bye' }] })), news }, x: wx, z: wz, parent: ctx.group, region: ctx.id });
}

// ================================================================ interactables, triggers, pickups
const interactables = [];
const portalPlates = [];
const triggers = [];
const pickups = [];

/**
 * interactable(ctx, { x, z, r = 2.2, label, prompt = 'E · use', onInteract(handle), once = false,
 *                     y = null, plateY = 2.6, sprite?, spriteScale?, icon? }) -> handle
 * Signs, chests, plaques, computers, bikes… A name plate shows the label; walking within r shows the
 * prompt, and E (or the touch E button) calls onInteract. handle: { x, z (local), enabled, label,
 * prompt, setLabel(t), setPrompt(t), remove(), mesh (if sprite) }.
 */
export function interactable(ctx, { x, z, r = 2.2, label = '', prompt = 'E · use', onInteract, once = false, y = null, plateY = 2.6, sprite: sp = null, spriteScale = 0.2, face = 0, see = 6 }) {
  const mesh = sp ? sprite(ctx, sp, { x, z, scale: spriteScale, face }) : null;
  const gy = y ?? ctx.surfaceY(x, z);
  const hint = h('span', { class: 'g__plate-hint' }, prompt);
  const name = h('b', null, label);
  const plate = h('div', { class: 'g__plate g__plate--thing' }, name, hint);
  const it = {
    ctx, x, z, r, once, enabled: true, onInteract, mesh, near: false, plate,
    get wx() { return x + ctx.ox; }, get wz() { return z + ctx.oz; },
    get label() { return name.textContent; },
    get prompt() { return hint.textContent; },
    setLabel(t) { name.textContent = t; },
    setPrompt(t) { hint.textContent = t; },
    remove() { it.enabled = false; it.unpin(); if (mesh) ctx.group.remove(mesh); const i = interactables.indexOf(it); if (i >= 0) interactables.splice(i, 1); },
  };
  // in play, a plate only shows when you're close to it, so a row of doors doesn't turn into a pile of labels
  const seeR = r + see;
  it.unpin = fx.pin(plate, () => {
    if (!it.enabled) return null;
    if (mode.play && Math.hypot(player.x - x - ctx.ox, player.z - z - ctx.oz) > seeR) return null;
    return { x: x + ctx.ox, y: gy + plateY, z: z + ctx.oz };
  }, { region: ctx.id, nearOnly: true });
  plate.addEventListener('click', () => { if (mode.play && it.near) use(it); });
  interactables.push(it);
  return it;
}
function use(it) {
  if (!it.enabled) return;
  try { it.onInteract?.(it); } catch (err) { console.warn('[regions] onInteract', err); }
  if (it.once) it.remove();
}
/** The nearest usable interactable in reach in the live region: { it, d } or null (index.js E key). */
export function nearestInteractable() {
  let best = null, bd = Infinity;
  for (const it of interactables) {
    if (!it.enabled || !it.ctx.live) continue;
    const d = Math.hypot(player.x - it.wx, player.z - it.wz);
    if (d < it.r && d / it.r < bd) { bd = d / it.r; best = it; }
  }
  return best ? { it: best, d: bd } : null;
}
export function useInteractable(it) { use(it); }

/**
 * trigger(ctx, { x, z, r = 2, w?, d?, onEnter(handle), onLeave?(handle), once = false, playOnly = true })
 * Area trigger (circle of radius r, or a w × d rectangle centred on x, z). Fires when the player
 * walks in. handle: { remove(), inside, enabled }.
 */
export function trigger(ctx, { x, z, r = 2, w = null, d = null, onEnter, onLeave = null, once = false, playOnly = true, minY = -Infinity, maxY = Infinity }) {
  const t = {
    ctx, x, z, r, w, d, once, onEnter, onLeave, playOnly, minY, maxY, inside: false, enabled: true,
    remove() { t.enabled = false; const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
  };
  triggers.push(t);
  return t;
}

/**
 * pickup(ctx, { x, z, id?, sprite = 'token', scale = 0.16, y?, onPick(handle), respawn? })
 * A floating, spinning collectible; walking into it collects it. With an `id` it stays collected
 * across reloads (ctx.state.picked[id]). handle: { remove(), taken }.
 */
export function pickup(ctx, { x, z, id = null, sprite: sp = 'token', scale = 0.16, y = null, onPick, respawn = null }) {
  const st = ctx.state;
  if (id && st.picked?.[id]) return { taken: true, remove() {} };
  const mesh = makeActor(sp, { scale, maxHalf: 1 });
  const base = (y ?? ctx.surfaceY(x, z)) + 0.8;
  mesh.position.set(x + ctx.ox, base, z + ctx.oz);
  ctx.group.add(mesh);
  const p = {
    ctx, x, z, id, mesh, base, taken: false, anim: ctx.rand() * 6, respawn, onPick,
    remove() { p.taken = true; mesh.visible = false; const i = pickups.indexOf(p); if (i >= 0) pickups.splice(i, 1); },
  };
  pickups.push(p);
  return p;
}

// ================================================================ portals
/**
 * portal(ctx, { x, z, to: 'hub' | regionId, at?: [x, z], label?, color = '#a78bfa', face = 0 })
 * A glowing voxel arch; walking through its centre travels. `at` is the arrival point: local
 * coordinates of the target region (world coordinates for the hub); omit it to arrive at the target's
 * spawn. Every region should have one back to the hub (to: 'hub'). handle: { remove(), mesh }.
 */
export function portal(ctx, { x, z, to = 'hub', at = null, label = null, color = '#a78bfa', face = 0 }) {
  const cells = [];
  for (let y = 0; y <= 5; y++) for (const u of [-2, 2]) cells.push([u, y, 0, shade(color, -0.25), 0.4]);
  for (let u = -2; u <= 2; u++) cells.push([u, 6, 0, color, 1.2]);
  for (let y = 0; y <= 5; y++) for (let u = -1; u <= 1; u++) cells.push([u, y, 0, color, 2.2]);
  const mesh = voxBuild(cells, { shadow: false });
  mesh.material.transparent = true;
  mesh.material.opacity = 0.9;
  const gy = ctx.surfaceY(x, z);
  mesh.position.set(x + ctx.ox, gy, z + ctx.oz);
  mesh.rotation.y = face;
  ctx.group.add(mesh);
  const c = Math.cos(face), s = Math.sin(face);
  block(ctx, x - 2 * c, z + 2 * s); block(ctx, x + 2 * c, z - 2 * s);
  const name = label || (to === 'hub' ? 'Back to UC San Diego' : `To ${regionName(to)}`);
  const plate = h('div', { class: 'g__plate g__plate--portal' }, h('b', null, name));
  const unpin = fx.pin(plate, () => ({ x: x + ctx.ox, y: gy + 7.4, z: z + ctx.oz }), { region: ctx.id, nearOnly: true });
  portalPlates.push({ ctx, plate, wx: x + ctx.ox, wz: z + ctx.oz, far: false });
  // arriving on (or next to) a portal must not bounce you straight back: it arms once you step away
  let armed = false;
  const trig = trigger(ctx, { x, z, r: 1.3, onEnter: () => { if (armed) env.travel?.(to, at, { via: 'portal' }); } });
  onEnter(ctx, () => { armed = false; });
  onUpdate(ctx, (dt, t) => {
    mesh.material.opacity = 0.75 + Math.sin(t * 3) * 0.15;
    if (!armed && Math.hypot(ctx.player.x - x, ctx.player.z - z) > 2.2) armed = true;
  });
  return { mesh, trigger: trig, remove() { trig.remove(); unpin(); ctx.group.remove(mesh); } };
}

// ================================================================ quests, items, eggs, talk
/** registerQuest(def) — see road.js. The quest's region defaults to the region being built. */
export function quest(def) { return regQuest({ region: building?.id || where.id, ...def }); }
export { regQuest as registerQuest, award, hasItem, ROAD, registerArt, boxCells, ringCells, shade, hash3 };

/**
 * egg(id, name, hint, done) -> find(opts?)
 * Registers a game egg (kind 'game', grouped by region in Field Notes; idempotent) and returns a
 * function that marks it found (find({ say }) overrides the toast subtitle). Eggs must be tied to
 * Yichen's real CV or to clearly-joke academic culture.
 */
export function egg(id, name, hint, done) {
  const region = building?.id || where.id;
  registerEgg({ id, kind: 'game', src: 'world', region, regionName: regionName(region), name, hint, done });
  return (opts) => found(id, opts);
}
export { found };

/** A world speech bubble over 'me' (the scholar), 'bit', an NPC id, or an NPC object. */
export function say(who, text, ms = 5200) {
  const id = typeof who === 'string' ? who : who?.id;
  env.say?.(id, text, ms);
}
export const banner = (title, sub = '', iconName = '') => gameBanner(title, sub, iconName);
export const toast = (text, opts) => gameToast(text, opts);
export const sfx = (name) => gameSfx(name);
/** Open a dialog node without an NPC (signs, terminals, cutscene text): node as in spawnNpc. */
export function dialog(node, { name = '', sprite: sp = 'scholar' } = {}) {
  talk({ id: `dialog:${name}`, region: '__dialog', cfg: { name, sprite: sp, talk: () => (typeof node === 'function' ? node() : node) }, plate: document.createElement('div') });
}

// ================================================================ sky, camera, riding
const SKY_DEFAULT = { tint: '#c7d2fe', ground: '#0b1024', fog: '#070a12', density: 0.0085, sun: 2.2 };
/** setSky({ tint, ground, fog, density, background, sun }) — applied now; travel re-applies region.sky. */
export function setSky(sky = {}) { env.setSky?.({ ...SKY_DEFAULT, ...sky }); }
/** A short camera move for intros/cutscenes: { x, y, z (local), yaw, pitch, dist, seconds }. */
export function cinematic(ctx, { x, y, z, yaw = null, pitch = 0.4, dist = 18, seconds = 2.5 }) {
  env.cinematic?.({ x: x + ctx.ox, y, z: z + ctx.oz, yaw, pitch, dist, seconds });
}
/** ride({ name, speed = 1.6 }): a temporary mount (bike, cart…); ends with dismount() or on travel. */
export function ride({ name = 'Bike', speed = 1.6 } = {}) { player.ride = { name, mult: speed }; gameToast(`Riding: ${name}. Press E again to get off.`, { icon: 'horse-head' }); emit('ride', name); }
export function dismount() { if (player.ride) { player.ride = null; emit('ride', null); } }
/** Unlock gliding (hold Space while falling). The hub gives it on the Torrey Pines bluff summit. */
export function unlockGlider() {
  if (S.world.glider) return false;
  S.world.glider = true;
  save();
  gameSfx('achievement');
  gameBanner('Torrey Pines glider', 'Hold Space while falling to glide.', 'star-swirl');
  emit('glider');
  return true;
}
/** Travel somewhere: travel('hub' | regionId, at?: [x, z]). */
export function travel(to, at = null) { return env.travel?.(to, at); }

// ================================================================ engine side (index.js / travel.js)
/** Per-frame: updaters, triggers and pickups of the live region. */
export function updateRegions(dt, t) {
  const ctx = built[where.id] || (where.id === 'hub' ? env.hubCtx : null);
  if (ctx) for (const fn of ctx.updaters.slice()) { try { fn(dt, t); } catch (err) { console.warn(`[regions] ${ctx.id} update`, err); } }
  for (const it of interactables) {
    if (!it.ctx.live) continue;
    const d = Math.hypot(player.x - it.wx, player.z - it.wz);
    const near = it.enabled && d < it.r;
    if (near !== it.near) { it.near = near; it.plate.classList.toggle('is-near', near); }
    const far = d > it.r + 14;
    if (far !== it.far) { it.far = far; it.plate.classList.toggle('is-far', far); }
  }
  for (const pl of portalPlates) {
    if (!pl.ctx.live) continue;
    const far = Math.hypot(player.x - pl.wx, player.z - pl.wz) > 22;
    if (far !== pl.far) { pl.far = far; pl.plate.classList.toggle('is-far', far); }
  }
  for (const tr of triggers.slice()) {
    if (!tr.enabled || !tr.ctx.live || (tr.playOnly && !mode.play) || player.dead) continue;
    const lx = player.x - tr.ctx.ox, lz = player.z - tr.ctx.oz;
    const inY = player.y >= tr.minY && player.y <= tr.maxY;
    const inside = inY && (tr.w != null ? Math.abs(lx - tr.x) <= tr.w / 2 && Math.abs(lz - tr.z) <= (tr.d ?? tr.w) / 2 : Math.hypot(lx - tr.x, lz - tr.z) <= tr.r);
    if (inside === tr.inside) continue;
    tr.inside = inside;
    try { if (inside) { tr.onEnter?.(tr); if (tr.once) tr.remove(); } else tr.onLeave?.(tr); } catch (err) { console.warn('[regions] trigger', err); }
  }
  for (const p of pickups.slice()) {
    if (p.taken || !p.ctx.live) continue;
    p.anim += dt * 2;
    p.mesh.position.y = p.base + Math.sin(p.anim) * 0.2;
    p.mesh.rotation.y = p.anim;
    if (mode.play && !player.dead && Math.hypot(player.x - p.x - p.ctx.ox, player.z - p.z - p.ctx.oz) < 1.3 && Math.abs(player.y + 1 - p.base) < 2.5) {
      p.taken = true; p.mesh.visible = false;
      if (p.id) { const st = p.ctx.state; st.picked = st.picked || {}; st.picked[p.id] = true; save(); }
      gameSfx('coin');
      fx.burst(p.mesh.position.x, p.base, p.mesh.position.z, '#f2b84b', 10, 4, 0.5, 0.6);
      try { p.onPick?.(p); } catch (err) { console.warn('[regions] onPick', err); }
      if (p.respawn) setTimeout(() => { p.taken = false; p.mesh.visible = true; }, p.respawn);
      else { const i = pickups.indexOf(p); if (i >= 0) pickups.splice(i, 1); }
    }
  }
}
/** Called by travel.js when a region becomes live / stops being live. */
export function regionEntered(id) {
  const ctx = built[id] || (id === 'hub' ? env.hubCtx : null);
  if (!ctx) return;
  for (const fn of ctx.enterFns) try { fn(ctx); } catch (err) { console.warn('[regions] onEnter', err); }
  try { ctx.def?.onEnter?.(ctx); } catch (err) { console.warn('[regions] def.onEnter', err); }
}
export function regionLeft(id) {
  const ctx = built[id] || (id === 'hub' ? env.hubCtx : null);
  if (!ctx) return;
  for (const fn of ctx.leaveFns) try { fn(ctx); } catch (err) { console.warn('[regions] onLeave', err); }
  try { ctx.def?.onLeave?.(ctx); } catch (err) { console.warn('[regions] def.onLeave', err); }
  for (const tr of triggers) if (tr.ctx === ctx) tr.inside = false;
}
export const allBuilt = () => Object.values(built);
