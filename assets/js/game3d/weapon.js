// The scholar's weapon: a voxel blade in his right hand that follows the equipped item (default: the
// Triton Blade, Triton blue with a gold guard), and the melee combo that swings it.
//   J / left click   1 slash (right to left) → 2 backslash → 3 spin slash (wider, stronger, a small lunge)
//                    a press during a swing is buffered; after a swing there is a short combo window
//   each swing       wind-up, fast arc with a voxel trail, the hit lands mid-arc (combat.swingHit), a
//                    brief hit-stop and camera shake when it connects, knockback on the target
//   spells (1-4)     a cast pose: the blade goes up and the hand glows
// Damage and targeting live in combat.js; this file is animation and timing only.
import * as THREE from 'three/webgpu';
import { on, emit } from './bus.js';
import { S } from './state.js';
import { ITEMS, RARITY_COLOR } from './data.js';
import { voxBuild } from './props.js';
import { player, markAction } from './player.js';
import { swingHit } from './combat.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';

// hand position in sprite voxel units (the sprite is 12 × 16 and faces +z; the right hand is at -x)
const HAND = new THREE.Vector3(-5.5, 3.5, 0.6);
const STEPS = [
  // dur (s), hit moment (0..1), arc (half-angle, rad), range multiplier, damage multiplier, knockback
  { dur: 0.26, hitAt: 0.42, arc: 1.25, range: 1, mult: 1, knock: 5, sfx: 'slash' },
  { dur: 0.26, hitAt: 0.42, arc: 1.25, range: 1, mult: 1.1, knock: 5, sfx: 'slash' },
  { dur: 0.4, hitAt: 0.5, arc: Math.PI, range: 1.2, mult: 1.6, knock: 11, sfx: 'slash3' },
];
const COMBO_WINDOW = 0.38;

let pivot = null, blade = null, tip = null, trail = null, castGlow = null;
let model = '';
let swing = null;          // { step, t, hit }
let queued = false;
let windowT = 0;           // combo window after a swing
let nextStep = 0;
let castT = 0;
let hitstopT = 0;
let spin = 0;              // extra yaw applied to the whole scholar during the spin slash
const _v = new THREE.Vector3();
let lastTip = null;

// ---------------------------------------------------------------- models
/** Cells for a blade in the pivot's space: grip at the origin, blade along +y. */
function swordCells({ blade: b = '#7dd3fc', edge = '#e0f2fe', guard = '#f2b84b', grip = '#1e3a8a', glow = 0.9, len = 9, curve = 0 }) {
  const c = [];
  c.push([0, -1, 0, guard, 0.3]);                                       // pommel
  for (let y = 0; y <= 1; y++) c.push([0, y, 0, grip, 0]);                // grip
  for (let x = -2; x <= 2; x++) c.push([x, 2, 0, guard, 0.5]);            // guard
  for (let y = 3; y < 3 + len; y++) {
    const off = curve ? Math.round(((y - 3) / len) ** 2 * curve) : 0;
    c.push([off, y, 0, b, glow]);
    if (y < 3 + len - 1) c.push([off + 1, y, 0, edge, glow * 0.6]);
  }
  c.push([Math.round(curve), 3 + len, 0, edge, glow]);                     // tip
  return c;
}
function staffCells(col, orb) {
  const c = [];
  for (let y = -1; y <= 10; y++) c.push([0, y, 0, y % 3 ? col : '#f2b84b', 0]);
  for (const [x, y, z] of [[0, 11, 0], [1, 12, 0], [-1, 12, 0], [0, 12, 1], [0, 12, -1], [0, 13, 0]]) c.push([x, y, z, orb, 2.2]);
  return c;
}
const MODELS = {
  default: () => swordCells({}),
  'iron-sword': () => swordCells({ blade: '#cbd5e1', edge: '#f1f5f9', guard: '#64748b', grip: '#3f3f46', glow: 0.1 }),
  'ember-sabre': () => swordCells({ blade: '#fb923c', edge: '#fde68a', guard: '#7c2d12', grip: '#451a03', glow: 1.3, curve: 2 }),
  'relic-blade': () => swordCells({ blade: '#a78bfa', edge: '#ede9fe', guard: '#4c1d95', grip: '#1e1b4b', glow: 1.2, len: 10 }),
  'sword-in-stone': () => swordCells({ blade: '#f8fafc', edge: '#fde68a', guard: '#f2b84b', grip: '#1e3a8a', glow: 1.5, len: 11 }),
};
/** The equipped weapon id (weapon slot, else the staff slot, else the default blade). */
function wanted() {
  const w = S.equipment.weapon, st = S.equipment.staff;
  if (w && MODELS[w]) return w;
  if (st && ITEMS[st]) return `staff:${st}`;
  return 'default';
}
function build() {
  const id = wanted();
  if (id === model && blade) return;
  model = id;
  if (blade) { pivot.remove(blade); blade.geometry?.dispose?.(); }
  let cells;
  if (id.startsWith('staff:')) {
    const it = ITEMS[id.slice(6)];
    cells = staffCells('#7c5a3a', RARITY_COLOR[it.rarity]);
  } else cells = MODELS[id]();
  blade = voxBuild(cells, { roughness: 0.4, metalness: 0.2 });
  blade.scale.setScalar(0.9);
  blade.castShadow = true;
  pivot.add(blade);
  const top = cells.reduce((m, c) => Math.max(m, c[1]), 0);
  tip.position.set(0, top * 0.9, 0);
}

function attach(group) {
  if (!pivot) {
    pivot = new THREE.Group();
    pivot.rotation.order = 'YXZ';
    tip = new THREE.Object3D();
    pivot.add(tip);
    castGlow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicNodeMaterial({ color: '#fde68a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    castGlow.visible = false;
    pivot.add(castGlow);
  }
  pivot.position.copy(HAND);
  group.add(pivot);
  build();
}

// ---------------------------------------------------------------- trail (pooled voxel cubes)
function makeTrail(scene) {
  const max = 120;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), max);
  mesh.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < max; i++) mesh.setMatrixAt(i, zero);
  mesh.count = max;
  scene.add(mesh);
  const parts = [];
  let next = 0;
  const m = new THREE.Matrix4(), col = new THREE.Color();
  return {
    add(x, y, z, color) {
      const i = next; next = (next + 1) % max;
      parts[i] = { x, y, z, t: 0 };
      mesh.setColorAt(i, col.set(color));
      mesh.instanceColor.needsUpdate = true;
    },
    update(dt) {
      let any = false;
      for (let i = 0; i < max; i++) {
        const p = parts[i];
        if (!p) continue;
        p.t += dt;
        const k = 1 - p.t / 0.24;
        if (k <= 0) { parts[i] = null; mesh.setMatrixAt(i, zero); any = true; continue; }
        m.makeScale(k * 1.4, k * 1.4, k * 1.4).setPosition(p.x, p.y, p.z);
        mesh.setMatrixAt(i, m);
        any = true;
      }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- api
export function initWeapon(scene) {
  trail = makeTrail(scene);
  attach(player.mesh);
  on('player:look', (g) => attach(g));
  on('equip', () => build());
  on('spell', () => { castT = 0.45; });
}

/** Attack input: start (or buffer) the next swing of the combo. */
export function attack() {
  if (player.dead) return false;
  if (swing) { if (swing.t / STEPS[swing.step].dur > 0.35) queued = true; return true; }
  start(windowT > 0 ? nextStep : 0);
  return true;
}
function start(step) {
  swing = { step, t: 0, hit: false };
  queued = false;
  windowT = 0;
  lastTip = null;
  markAction();
  sfx(STEPS[step].sfx);
  if (step === 2) {                                   // the spin lunges a little forward
    player.vx += Math.sin(player.yaw) * 7;
    player.vz += Math.cos(player.yaw) * 7;
  }
  emit('player:swing', step);
}

/** Remaining hit-stop (s): index.js freezes the simulation (not the camera or effects) while > 0. */
export const hitstop = () => hitstopT;
/** Extra yaw for the scholar mesh (spin slash). */
export const spinYaw = () => spin;
export const swinging = () => !!swing;

/** Pose for the current frame. rest: blade held low and forward; swings sweep around the body. */
export function updateWeapon(dt, { vehicle = null } = {}) {
  if (!pivot) return;
  hitstopT = Math.max(0, hitstopT - dt);
  const hidden = vehicle === 'car' || vehicle === 'mech';
  pivot.visible = !hidden;
  if (hidden) { swing = null; spin = 0; }
  trail.update(dt);
  if (windowT > 0) windowT -= dt;
  castT = Math.max(0, castT - dt);

  let rx = 0.55, ry = -0.35, rz = 0.1;
  spin = 0;
  if (swing) {
    const S0 = STEPS[swing.step];
    if (hitstopT <= 0) swing.t += dt;
    const k = Math.min(1, swing.t / S0.dur);
    const wind = 0.22;                                 // share of the swing spent winding up
    const e = k < wind ? 0 : (k - wind) / (1 - wind);
    const ease = 1 - (1 - e) ** 3;
    rx = Math.PI / 2 - 0.1;                            // blade horizontal, pointing forward
    if (swing.step === 0) { ry = k < wind ? -1.5 - (k / wind) * 0.35 : -1.85 + ease * 3.6; rz = -0.3; }
    else if (swing.step === 1) { ry = k < wind ? 1.6 + (k / wind) * 0.3 : 1.9 - ease * 3.7; rz = 0.35; }
    else { ry = -Math.PI / 2; rz = 0; spin = k < wind ? -0.25 * (k / wind) : -0.25 + ease * (Math.PI * 2 + 0.25); }
    pivot.rotation.set(rx, ry, rz);
    // trail from the blade tip while the arc is live
    if (e > 0 && e < 1) {
      player.mesh.updateMatrixWorld(true);
      tip.getWorldPosition(_v);
      const col = swing.step === 2 ? '#fde68a' : '#7dd3fc';
      if (lastTip) for (let i = 1; i <= 3; i++) trail.add(lastTip.x + (_v.x - lastTip.x) * i / 3, lastTip.y + (_v.y - lastTip.y) * i / 3, lastTip.z + (_v.z - lastTip.z) * i / 3, col);
      lastTip = _v.clone();
    }
    if (!swing.hit && k >= S0.hitAt) {
      swing.hit = true;
      const n = swingHit({ step: swing.step, arc: S0.arc, range: S0.range, mult: S0.mult, knock: S0.knock, yaw: player.yaw + spin });
      if (n > 0) { hitstopT = swing.step === 2 ? 0.09 : 0.06; fx.shake(swing.step === 2 ? 0.28 : 0.16, 140); }
    }
    if (k >= 1) {
      const step = swing.step;
      swing = null;
      nextStep = (step + 1) % STEPS.length;
      windowT = step === 2 ? 0 : COMBO_WINDOW;
      if (queued && step < 2) start(nextStep);
      queued = false;
    }
    return;
  }
  if (castT > 0) {
    const k = castT / 0.45;
    rx = -0.25; ry = 0; rz = -0.15;
    castGlow.visible = true;
    castGlow.position.copy(tip.position);
    castGlow.material.opacity = Math.sin(k * Math.PI) * 0.8;
    castGlow.scale.setScalar(1 + (1 - k) * 1.5);
  } else if (castGlow.visible) castGlow.visible = false;
  // idle: a gentle sway; walking: the blade swings with the stride
  const walk = player.walking ? Math.sin(player.t * 1.2) * 0.25 : Math.sin(performance.now() / 700) * 0.04;
  pivot.rotation.set(rx + walk, ry, rz);
}
