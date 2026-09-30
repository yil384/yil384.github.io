// Ways to get around, all available from the start (V cycles: on foot → flying sword → exosuit → car).
//   Flying sword (御剑飞行)  stand on a giant glowing blade and fly; light trail behind it
//   Mk-35 Triton exosuit    an original UCSD navy-and-gold flight suit: hover, thrusters, boost, land;
//                           J fires the shoulder cannon
//   Sports car              fast ground driving: W/S throttle, A/D steer, Space drift, Shift/F boost,
//                           H honk; running into foes bowls them over
// Flight: Space climbs, Shift (or Z) descends, F boosts. A soft ceiling and soft region bounds push
// you back; flying far past them brings you gently back to the spawn. Portals and doors still work.
import * as THREE from 'three/webgpu';
import { voxBuild, boxCells } from './props.js';
import { player, markAction } from './player.js';
import { lerpAngle } from './move.js';
import { targetsWithin, dealDamage, spawnProjectile } from './combat.js';
import { clock } from './clock.js';
import { where } from './where.js';
import { emit } from './bus.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';

export const VEHICLES = [
  { id: null, name: 'On foot' },
  { id: 'sword', name: 'Flying sword', hint: 'Space up · Shift down · F boost' },
  { id: 'mech', name: 'Mk-35 Triton exosuit', hint: 'Space up · Shift down · F boost · J cannon' },
  { id: 'car', name: 'Sports car', hint: 'W/S drive · A/D steer · Space drift · Shift boost · H honk' },
];
const CEILING = 64;             // soft flight ceiling (world y)

// ---------------------------------------------------------------- models (sprite-free voxel builds)
function swordModel() {
  const c = [];
  for (let z = -4; z <= 7; z++) {
    const w = z < 6 ? 1 : 0;
    for (let x = -w; x <= w; x++) c.push([x, 0, z, x === 0 ? '#7dd3fc' : '#e0f2fe', x === 0 ? 2.4 : 1.2]);
  }
  c.push([0, 0, 8, '#f0f9ff', 2.6]);
  for (let x = -3; x <= 3; x++) c.push([x, 0, -5, '#f2b84b', 0.6]);
  for (let z = -8; z <= -6; z++) c.push([0, 0, z, '#1e3a8a', 0]);
  c.push([0, 0, -9, '#f2b84b', 0.8]);
  const m = voxBuild(c, { roughness: 0.3, metalness: 0.3 });
  const g = new THREE.Group();
  m.scale.set(0.34, 0.3, 0.34);
  g.add(m);
  return g;
}
function mechModel() {
  const N = '#182b49', n = '#22406e', G = '#f2b84b', D = '#0f1a2e', V = '#7dd3fc', O = '#fb923c';
  const c = [];
  const add = (cells) => c.push(...cells);
  // legs + boots
  for (const sx of [-1, 1]) {
    add(boxCells(sx * 2 - (sx > 0 ? 0 : 1), sx * 2 + (sx > 0 ? 1 : 0), 1, 5, -1, 1, N, { pick: (x, y) => (y === 3 ? G : N) }));
    add(boxCells(sx * 2 - (sx > 0 ? 0 : 1), sx * 2 + (sx > 0 ? 1 : 0), 0, 0, -1, 2, D));
    c.push([sx * 2 + (sx > 0 ? 1 : -1) * 0, 0, -1, O, 1.6]);
  }
  add(boxCells(-3, 3, 6, 7, -1, 1, n));                                  // hips
  add(boxCells(-4, 4, 8, 12, -2, 2, N, { pick: (x, y, z) => (z === 2 && y >= 9 && y <= 11 && Math.abs(x) <= 1 ? G : (Math.abs(x) === 4 ? n : N)) }));
  // trident emblem on the chest (original mark)
  for (const [x, y] of [[0, 9], [0, 10], [0, 11], [-1, 11], [1, 11], [-1, 12], [1, 12], [0, 12]]) c.push([x, y, 3, G, 0.9]);
  // arms with gold gauntlets
  for (const sx of [-1, 1]) {
    add(boxCells(sx * 5, sx * 6, 8, 12, -1, 1, n, { pick: (x, y) => (y <= 9 ? G : n) }));
    c.push([sx * 6, 13, 0, N, 0]);                                        // shoulder cap
    add(boxCells(sx * 5, sx * 6, 7, 7, -1, 1, D));                        // hands
  }
  // head + visor
  add(boxCells(-2, 2, 13, 16, -2, 2, N, { pick: (x, y, z) => (y === 14 && z === 2 ? V : y === 16 ? n : N) }));
  for (let x = -2; x <= 2; x++) c.push([x, 14, 3, V, 2.2]);
  c.push([0, 17, 0, G, 0.8]);
  // back thrusters
  for (const sx of [-2, 2]) { add(boxCells(sx, sx, 9, 12, -4, -3, D)); c.push([sx, 8, -3, O, 2.5], [sx, 8, -4, O, 2.5]); }
  const m = voxBuild(c, { roughness: 0.45, metalness: 0.35 });
  m.scale.setScalar(0.3);
  const g = new THREE.Group();
  g.add(m);
  g.userData.height = 18 * 0.3;
  return g;
}
function carModel() {
  const B = '#f2b84b', b = '#d49a2c', N = '#182b49', W = '#111318', G = '#9ad8ff', L = '#fff7d6', R = '#ef4444', S = '#f3cfa4', K = '#15151c';
  const c = [];
  const add = (cells) => c.push(...cells);
  add(boxCells(-2, 2, 1, 1, -5, 5, B, { pick: (x, y, z) => (x === 0 ? N : (z % 3 === 0 ? b : B)) }));   // chassis with a navy stripe
  add(boxCells(-2, 2, 2, 2, -5, 5, B, { pick: (x, y, z) => (x === 0 ? N : B), hollow: false }));
  add(boxCells(-2, 2, 3, 3, -2, 1, G, { pick: (x, y, z) => (Math.abs(x) === 2 || z === -2 ? G : (x === 0 ? N : B)) }));   // cabin glass
  add(boxCells(-1, 1, 4, 4, -1, 0, B, { pick: (x) => (x === 0 ? N : B) }));                                             // roof
  c.push([0, 4, -3, S, 0], [0, 5, -3, K, 0]);                                                                            // the driver peeks out
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { add(boxCells(x, x, 0, 1, z - 1, z, W)); }
  for (const x of [-2, 2]) { c.push([x, 2, 6, L, 3]); c.push([x, 2, -6, R, 2.2]); }
  add(boxCells(-2, 2, 4, 4, -5, -5, N));                                                                                   // spoiler
  const m = voxBuild(c, { roughness: 0.35, metalness: 0.4 });
  m.scale.setScalar(0.42);
  const g = new THREE.Group();
  g.add(m);
  return g;
}

// ---------------------------------------------------------------- controller
export function createVehicles({ scene, world, input, rig, mover, onOut }) {
  const models = {};
  let trailT = 0;
  const hitCd = new WeakMap();
  const found = { sword: false, mech: false, car: false };

  function model(id) {
    if (!models[id]) { models[id] = id === 'sword' ? swordModel() : id === 'mech' ? mechModel() : carModel(); models[id].visible = false; scene.add(models[id]); }
    return models[id];
  }

  function set(id) {
    const prev = player.vehicle;
    if (prev === id) return;
    if (prev) model(prev).visible = false;
    player.vehicle = id;
    player.vy = Math.max(0, player.vy);
    if (id) {
      model(id).visible = true;
      if (id === 'car') { player.carYaw = player.yaw; player.carSpeed = Math.hypot(player.vx, player.vz); }
      if (id !== 'car') { player.grounded = false; player.vy = 4; }
      sfx('vehicle');
      fx.ring(player.x, player.y, player.z, id === 'sword' ? '#7dd3fc' : id === 'mech' ? '#f2b84b' : '#fde68a', 2.4, 0.6);
    } else {
      player.grounded = false;
    }
    emit('vehicle', id);
  }
  function cycle() {
    const i = VEHICLES.findIndex((v) => v.id === (player.vehicle || null));
    const next = VEHICLES[(i + 1) % VEHICLES.length];
    set(next.id);
    return next;
  }

  /** Keep flyers inside the soft ceiling / region bounds; far outside → back to the spawn. */
  function bounds(dt) {
    if (player.y > CEILING) player.vy -= (player.y - CEILING) * 6 * dt;
    const dx = player.x - where.ox, dz = player.z - where.oz, r = Math.hypot(dx, dz);
    const R = where.bound || 90;
    if (r > R) { const push = (r - R) * 3 * dt; player.vx -= dx / r * push * 4; player.vz -= dz / r * push * 4; }
    if (r > R + 45 || player.y > CEILING + 30) onOut();
  }

  function fly(dt, kind) {
    const w = mover.wish();
    const boost = input.down('KeyF') || input.down('Boost');
    const maxS = kind === 'sword' ? (boost ? 36 : 22) : (boost ? 32 : 15);
    const acc = kind === 'sword' ? 4.5 : 3.2;
    const k = 1 - Math.exp(-acc * dt);
    player.vx += (w.x * maxS - player.vx) * k;
    player.vz += (w.z * maxS - player.vz) * k;
    const up = input.down('Space') || input.down('Up');
    const down = input.down('ShiftLeft') || input.down('ShiftRight') || input.down('KeyZ') || input.down('Down');
    const tvy = ((up ? 1 : 0) - (down ? 1 : 0)) * (kind === 'sword' ? 13 : 11) + (kind === 'mech' && !up && !down ? -0.6 : 0);
    player.vy += (tvy - player.vy) * (1 - Math.exp(-5 * dt));
    bounds(dt);
    // walls: blocked cells, or ground higher than we are
    const nx = player.x + player.vx * dt, nz = player.z + player.vz * dt;
    const ok = (x, z) => !world.isBlocked(x, z) || world.height(x, z) + 0.5 < player.y - 2;
    if (ok(nx, player.z) && world.height(nx, player.z) + 0.5 <= player.y + 0.9) player.x = nx; else player.vx *= -0.2;
    if (ok(player.x, nz) && world.height(player.x, nz) + 0.5 <= player.y + 0.9) player.z = nz; else player.vz *= -0.2;
    player.y += player.vy * dt;
    const g = world.height(player.x, player.z);
    const minY = g === -Infinity ? -Infinity : g + 0.5 + (kind === 'sword' ? 0.9 : 0);
    player.grounded = false;
    if (player.y < minY) { player.y = minY; player.vy = Math.max(0, player.vy); player.grounded = kind === 'mech'; }
    if (player.y < -16) onOut();
    const hs = Math.hypot(player.vx, player.vz);
    if (rig.firstPerson) player.yaw = rig.yaw + Math.PI;
    else if (hs > 0.5) player.yaw = lerpAngle(player.yaw, Math.atan2(player.vx, player.vz), 1 - Math.exp(-8 * dt));
    player.walking = kind === 'mech' && player.grounded && hs > 1;
    if (hs > 0.5 || player.vy) markAction();
    // trails / thrusters
    trailT -= dt;
    if (trailT <= 0) {
      trailT = 0.035;
      if (kind === 'sword') fx.burst(player.x - Math.sin(player.yaw) * 1.8, player.y - 0.3, player.z - Math.cos(player.yaw) * 1.8, boost ? '#e0f2fe' : '#7dd3fc', 1, 0.6, 0.45, 0.55);
      else if (!player.grounded || up) {
        for (const s of [-1, 1]) fx.burst(player.x + Math.cos(player.yaw) * 0.5 * s - Math.sin(player.yaw) * 0.9, player.y + 1.8, player.z - Math.sin(player.yaw) * 0.5 * s - Math.cos(player.yaw) * 0.9, boost ? '#fde68a' : '#fb923c', 1, 1.2, 0.35, 0.6);
        if (boost && Math.random() < 0.3) sfx('thrust');
      }
    }
    // model pose
    const m = model(kind);
    const lat = Math.cos(player.yaw) * player.vx - Math.sin(player.yaw) * player.vz;
    if (kind === 'sword') {
      m.position.set(player.x, player.y - 0.35 + Math.sin(clock.t / 300) * 0.08, player.z);
      m.rotation.set(-player.vy * 0.015, player.yaw, -lat * 0.02);
    } else {
      m.position.set(player.x, player.y + (player.grounded ? 0 : Math.sin(clock.t / 260) * 0.12), player.z);
      m.rotation.set(Math.min(0.35, hs * 0.012), player.yaw, -lat * 0.015);
    }
    if (!found[kind]) { found[kind] = true; emit('vehicle:first', kind); }
  }

  function drive(dt) {
    const v = input.axis();
    const throttle = -v.y, steer = v.x;
    const boost = input.down('ShiftLeft') || input.down('ShiftRight') || input.down('KeyF') || input.down('Boost');
    const drift = input.down('Space');
    let s = player.carSpeed || 0;
    const top = boost ? 38 : 26;
    s += throttle * (throttle * s < 0 ? 40 : boost ? 34 : 20) * dt;
    s *= Math.exp(-(throttle ? 0.35 : 1.3) * dt);
    s = Math.max(-9, Math.min(top, s));
    const grip = drift ? 1.8 : 9;
    const turn = (drift ? 2.9 : 2.1) * Math.min(1, Math.abs(s) / 7) * Math.sign(s || 1);
    player.carYaw = (player.carYaw ?? player.yaw) - steer * turn * dt;
    const fx0 = Math.sin(player.carYaw), fz0 = Math.cos(player.carYaw);
    const k = 1 - Math.exp(-grip * dt);
    player.vx += (fx0 * s - player.vx) * k;
    player.vz += (fz0 * s - player.vz) * k;
    const nx = player.x + player.vx * dt, nz = player.z + player.vz * dt;
    const bumped = () => { s *= -0.3; player.vx *= -0.3; player.vz *= -0.3; fx.burst(player.x + fx0 * 2, player.y + 1, player.z + fz0 * 2, '#fde68a', 8, 4, 0.3, 0.5); fx.shake(0.25, 160); };
    if (mover.canEnter(nx, player.z, 1.05)) player.x = nx; else bumped();
    if (mover.canEnter(player.x, nz, 1.05)) player.z = nz; else bumped();
    player.carSpeed = s;
    // ground + gravity (the car hops down ledges and up single steps)
    const g = world.height(player.x, player.z);
    const ground = g === -Infinity ? -Infinity : g + 0.5;
    if (player.grounded && ground > -Infinity && ground >= player.y - 1.05) { player.y = ground; player.vy = 0; }
    else {
      player.grounded = false;
      player.vy -= 34 * dt;
      player.y += player.vy * dt;
      if (ground > -Infinity && player.y <= ground) { player.y = ground; player.vy = 0; player.grounded = true; }
      if (player.y < -16) onOut();
    }
    player.yaw = player.carYaw;
    player.walking = false;
    if (Math.abs(s) > 0.5) markAction();
    rig.follow(player.carYaw + Math.PI, 1 - Math.exp(-3 * dt));
    // skids, speed puffs
    trailT -= dt;
    if (trailT <= 0 && Math.abs(s) > 8) {
      trailT = drift ? 0.03 : 0.08;
      const back = -1.9;
      for (const side of [-1, 1]) fx.burst(player.x + fx0 * back + fz0 * side, player.y + 0.2, player.z + fz0 * back - fx0 * side, drift ? '#e5e7eb' : boost ? '#fde68a' : '#94a3b8', 1, 1, 0.35, 0.6);
    }
    // bowling: foes in the way take damage and fly
    if (Math.abs(s) > 7) {
      for (const t of targetsWithin(player.x, player.z, 1.9)) {
        if ((hitCd.get(t) || 0) > clock.t) continue;
        hitCd.set(t, clock.t + 600);
        dealDamage(t, Math.round(Math.abs(s) * (t.boss ? 0.6 : 1.4)), { source: 'player' });
        t.knock?.(fx0, fz0, Math.abs(s) * 0.9);
        fx.shake(0.2, 120);
        s *= 0.8;
      }
    }
    const m = model('car');
    const lat = Math.cos(player.carYaw) * player.vx - Math.sin(player.carYaw) * player.vz;
    m.position.set(player.x, player.y, player.z);
    m.rotation.set(0, player.carYaw, Math.max(-0.12, Math.min(0.12, -lat * 0.01)));
    if (!found.car) { found.car = true; emit('vehicle:first', 'car'); }
  }

  let lastCannon = -1e9;
  return {
    set, cycle,
    get id() { return player.vehicle; },
    step(dt) {
      if (player.vehicle === 'car') drive(dt);
      else fly(dt, player.vehicle);
    },
    /** J while in the exosuit: the shoulder cannon. Returns true if handled. */
    fire() {
      if (player.vehicle === 'car') return true;
      if (player.vehicle !== 'mech' || clock.t - lastCannon < 320) return player.vehicle === 'mech';
      lastCannon = clock.t;
      const a = rig.firstPerson ? rig.yaw + Math.PI : player.yaw;
      const t = targetsWithin(player.x, player.z, 22).sort((p, q) => Math.hypot(p.x - player.x, p.z - player.z) - Math.hypot(q.x - player.x, q.z - player.z))[0];
      spawnProjectile({ x: player.x + Math.cos(a) * 0.9, y: player.y + 3.4, z: player.z - Math.sin(a) * 0.9, tx: t ? t.x : player.x + Math.sin(a) * 20, ty: t ? t.y + t.h * 0.5 : player.y + 3, tz: t ? t.z : player.z + Math.cos(a) * 20, target: t, homing: t ? 4 : 0, speed: 26, friendly: true, damage: 14, radius: 0.7, source: 'player', kind: 'spark', trail: '#fde68a', size: 0.8 });
      sfx('zap');
      return true;
    },
    honk() {
      if (player.vehicle !== 'car') return false;
      sfx('honk');
      fx.text(player.x, player.y + 3, player.z, 'BEEP BEEP', 'gold');
      for (const t of targetsWithin(player.x, player.z, 8)) if (!t.boss) { const dx = t.x - player.x, dz = t.z - player.z, l = Math.hypot(dx, dz) || 1; t.knock?.(dx / l, dz / l, 6); }
      emit('vehicle:honk');
      return true;
    },
    hideAll() { for (const m of Object.values(models)) m.visible = false; },
    sync() { for (const [id, m] of Object.entries(models)) m.visible = id === player.vehicle; },
  };
}
