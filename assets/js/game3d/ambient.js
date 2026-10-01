// Campus life on the hub: tiny students walking Library Walk, Warren Mall and Price Center, a few
// skateboarders, cyclists on the loop road and the campus shuttle. Purely decorative (no collision,
// never in the way of the game). Everyone is one instanced mesh (people with their bikes and boards)
// plus the bus: two draw calls. Anyone far from the camera is hidden, and nothing ticks off the hub.
import * as THREE from 'three/webgpu';
import { attribute, instancedBufferAttribute, mix, float, vec3, positionLocal } from 'three/tsl';
import { GeoWriter, rgb, voxMesh } from './voxmesh.js';
import { LAYOUT } from './layout.js';
import { where } from './where.js';
import { reducedMotion } from '../three/boot.js';

const SHIRTS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f8fafc', '#1f3b73', '#f2c14e', '#14b8a6', '#fb923c', '#64748b'];

/** Boxes -> geometry with per-vertex `mask` (1 = takes the instance's tint) and `part` (0 person, 1 bike, 2 board). */
function boxesGeo(boxes) {
  const w = new GeoWriter(false);
  const mask = [], parts = [];
  const F = [
    [[-1, 0, 0], [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]]], [[1, 0, 0], [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]]],
    [[0, -1, 0], [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]]], [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]]],
    [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]]], [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]],
  ];
  for (const [x0, y0, z0, x1, y1, z1, col, m = 0, part = 0] of boxes) {
    const [r, g, b] = rgb(col);
    for (const [n, cs] of F) {
      const base = w.v;
      const shade = n[1] > 0 ? 1 : n[1] < 0 ? 0.6 : 0.85;
      for (const c of cs) { w.vert(c[0] ? x1 : x0, c[1] ? y1 : y0, c[2] ? z1 : z0, n[0], n[1], n[2], r * shade, g * shade, b * shade); mask.push(m); parts.push(part); }
      w.quad(base);
    }
  }
  const geo = w.geometry();
  geo.setAttribute('mask', new THREE.Float32BufferAttribute(mask, 1));
  geo.setAttribute('part', new THREE.Float32BufferAttribute(parts, 1));
  return geo;
}

/**
 * One instanced mesh for everyone: the geometry holds a person, a bike and a board; each instance's
 * `kit` (0 walker, 1 cyclist, 2 skater) keeps the person plus its own ride and collapses the rest,
 * and lifts the rider onto the saddle or the deck. `tint` colours the shirt, `tint2` the ride.
 */
function crowdMesh(geo, count) {
  const tint = new Float32Array(count * 3), tint2 = new Float32Array(count * 3), kit = new Float32Array(count);
  const tA = new THREE.InstancedBufferAttribute(tint, 3), tB = new THREE.InstancedBufferAttribute(tint2, 3), kA = new THREE.InstancedBufferAttribute(kit, 1);
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.8 });
  const part = attribute('part', 'float'), k = instancedBufferAttribute(kA, 'float');
  const person = float(1).sub(part.min(1));
  const show = person.max(float(1).sub(part.sub(k).abs().min(1)));
  const lift = mix(mix(float(0), float(0.42), k.min(1)), float(0.16), k.sub(1).max(0));
  mat.positionNode = positionLocal.add(vec3(0, lift.mul(person), 0)).mul(show);
  const tintSel = mix(instancedBufferAttribute(tB, 'vec3'), instancedBufferAttribute(tA, 'vec3'), person);
  mat.colorNode = mix(attribute('color', 'vec3'), tintSel, attribute('mask', 'float'));
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, tint, tint2, kit, attrs: [tA, tB, kA] };
}

export function createAmbient(world, parent, { lowfx = false, loop } = {}) {
  const S = lowfx ? 0.6 : 1;
  const hub = world.hub;
  // ---- geometry ----
  // a student: legs, shirt (tinted), head with hair, a backpack. ~1.7 units tall.
  const geo = boxesGeo([
    // a student: legs, shirt (tinted), head with hair, a backpack. ~1.7 units tall.
    [-0.3, 0, -0.14, -0.04, 0.72, 0.14, '#2b3140'], [0.04, 0, -0.14, 0.3, 0.72, 0.14, '#2b3140'],
    [-0.33, 0.72, -0.18, 0.33, 1.32, 0.18, '#ffffff', 1],
    [-0.22, 1.32, -0.2, 0.22, 1.72, 0.2, '#f1c9a5'],
    [-0.24, 1.66, -0.22, 0.24, 1.8, 0.22, '#2b2118'],
    [-0.24, 0.8, -0.34, 0.24, 1.24, -0.18, '#334155'],
    // a bike (part 1)
    [-0.06, 0.05, -0.62, 0.06, 0.55, -0.22, '#111827', 0, 1], [-0.06, 0.05, 0.22, 0.06, 0.55, 0.62, '#111827', 0, 1],
    [-0.05, 0.45, -0.45, 0.05, 0.55, 0.45, '#ffffff', 1, 1], [-0.05, 0.45, 0.35, 0.05, 0.9, 0.45, '#ffffff', 1, 1],
    [-0.25, 0.86, 0.33, 0.25, 0.92, 0.43, '#94a3b8', 0, 1], [-0.1, 0.6, -0.3, 0.1, 0.68, -0.1, '#1f2937', 0, 1],
    // a skateboard (part 2)
    [-0.18, 0.08, -0.5, 0.18, 0.16, 0.5, '#ffffff', 1, 2], [-0.16, 0, -0.38, 0.16, 0.08, -0.3, '#111827', 0, 2], [-0.16, 0, 0.3, 0.16, 0.08, 0.38, '#111827', 0, 2],
  ]);

  // ---- agents ----
  const agents = [];
  const rnd = (() => { let a = 1234567; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const pickC = (a) => a[Math.floor(rnd() * a.length)];
  // lanes: straight back-and-forth walks
  const lane = (n, ax, az, bx, bz, spread, speed, kind = 'walk') => {
    for (let i = 0; i < Math.round(n * S); i++) {
      const u = rnd(), side = (rnd() - 0.5) * 2 * spread;
      const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
      agents.push({ kind, mode: 'lane', ax: ax + nx * side, az: az + nz * side, bx: bx + nx * side, bz: bz + nz * side, u, dir: rnd() < 0.5 ? 1 : -1, speed: speed * (0.8 + rnd() * 0.4) / len, shirt: pickC(SHIRTS), phase: rnd() * 6, pause: 0 });
    }
  };
  const LW = LAYOUT.libwalk;
  const lwx = (LW.x0 + LW.x1) / 2;
  lane(16, lwx, LW.z0 + 1, lwx, LW.z1, 2.2, 1.5);
  lane(3, lwx, LW.z0 + 1, lwx, LW.z1, 1.6, 4.2, 'skate');
  const Wp = LAYOUT.plots.find((p) => p.id === 'warren');
  lane(9, Wp.cx - Wp.hx + 1, -42.5, Wp.cx + Wp.hx - 1, -42.5, 1.6, 1.4);
  lane(2, Wp.cx - Wp.hx + 1, -42.5, Wp.cx + Wp.hx - 1, -42.5, 1.2, 4.5, 'skate');
  lane(4, 26, 9.5, 26, -5, 0.4, 1.3);                      // along the road by the pier
  // Price Center: wander between spots
  const Pp = LAYOUT.plots.find((p) => p.id === 'price');
  for (let i = 0; i < Math.round(12 * S); i++) {
    agents.push({ kind: 'walk', mode: 'wander', box: [Pp.cx - Pp.hx + 4.5, Pp.cx + Pp.hx - 1, Pp.cz - Pp.hz + 4, Pp.cz + Pp.hz - 4.5], x: Pp.cx + (rnd() - 0.5) * 12, z: Pp.cz + (rnd() - 0.5) * 3, tx: 0, tz: 0, speed: 1.2 + rnd() * 0.5, shirt: pickC(SHIRTS), phase: rnd() * 6, pause: rnd() * 2 });
  }
  // cyclists on the loop road (keeping right)
  for (let i = 0; i < Math.round(6 * S); i++) agents.push({ kind: 'bike', mode: 'loop', s: rnd() * loop.length, dir: i % 2 ? 1 : -1, speed: 4.5 + rnd() * 1.5, shirt: pickC(SHIRTS), frame: pickC(['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#e5e7eb']), phase: rnd() * 6 });

  const crowd = crowdMesh(geo, agents.length);
  crowd.mesh.name = 'ambient-crowd';
  const c = new THREE.Color();
  agents.forEach((a, i) => {
    c.set(a.shirt);
    crowd.tint.set([c.r, c.g, c.b], i * 3);
    crowd.kit[i] = a.kind === 'bike' ? 1 : a.kind === 'skate' ? 2 : 0;
    c.set(a.kind === 'bike' ? a.frame : pickC(['#f97316', '#22d3ee', '#a3e635', '#f472b6']));
    crowd.tint2.set([c.r, c.g, c.b], i * 3);
    a.x ??= 0; a.z ??= 0; a.y = 0; a.yaw = 0;
  });
  for (const at of crowd.attrs) at.needsUpdate = true;
  parent.add(crowd.mesh);

  // ---- the shuttle ----
  const busCells = [];
  for (let x = -4; x <= 4; x++) for (let z = -1; z <= 1; z++) for (let y = 0; y <= 3; y++) {
    const shell = Math.abs(x) === 4 || Math.abs(z) === 1 || y === 0 || y === 3;
    if (!shell) continue;
    let col = '#f8fafc', g = 0;
    if (y === 0) col = Math.abs(x) === 3 && Math.abs(z) === 1 ? '#111827' : '#334155';
    else if (y === 1) col = '#1d4ed8';
    else if (y === 2) { col = Math.abs(x) === 4 ? '#bfe3ff' : x % 2 ? '#1e293b' : '#ffe6a3'; g = col === '#ffe6a3' ? 0.7 : col === '#bfe3ff' ? 0.4 : 0; }
    else col = (x + z) % 2 ? '#f2c14e' : '#f8fafc';
    if (y === 1 && x === 4 && z !== 0) { col = '#fff7d6'; g = 1.4; }
    busCells.push([x, y, z, col, g]);
  }
  const bus = voxMesh(busCells, { shadow: false, ao: false });
  bus.name = 'shuttle';
  parent.add(bus);
  const busState = { s: 0, dwell: 0, y: 3, speed: 6.2 };
  const stopIdx = LAYOUT.stops.map((s) => loop.findIndex((p) => p.seg === s.at)).filter((i) => i >= 0);

  // ---- per frame ----
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const cam = new THREE.Vector3();
  const L = loop.length;
  const at = (s) => { const i = Math.floor(((s % L) + L) % L), f = s - Math.floor(s); const a = loop[i], b = loop[(i + 1) % L]; return [a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, Math.atan2(b.x - a.x, b.z - a.z)]; };
  const ground = (x, z) => { const h = hub.height(x, z); return h > -Infinity ? h + 0.5 : 0; };
  const HIDE = lowfx ? 90 : 120;
  const place = (mesh, i, x, y, z, yaw, s = 1) => { m4.compose(pos.set(x, y, z), q.setFromAxisAngle(up, yaw), sc.set(s, s, s)); mesh.setMatrixAt(i, m4); };
  let t = 0;

  /**
   * Walkers and skaters near (x, z) stop and react to the player: 'wave' (face you, two little hops),
   * 'dance' (bob along on the beat), 'bump' (a startled hop). Cyclists keep riding. Returns how many joined.
   */
  function react(x, z, r, kind, dur, max = 99) {
    let n = 0;
    for (const a of agents) {
      if (n >= max || a.mode === 'loop' || Math.hypot(a.x - x, a.z - z) > r) continue;
      a.react = { kind, t: dur + rnd() * 0.3, x, z };
      n++;
    }
    return n;
  }

  function update(dt, camera) {
    if (where.id !== 'hub') return;
    const calm = reducedMotion.matches;
    const rdt = dt;                   // reactions time out even when reduced motion freezes the crowd
    if (calm) dt = 0;
    t += dt;
    camera.getWorldPosition(cam);
    agents.forEach((a, i) => {
      if (a.react) {
        const r = a.react;
        r.t -= rdt;
        if (r.t <= 0) a.react = null;
        else {
          // stand still, turn to the player, hop / bob (no motion at all under reduced motion)
          const face = Math.atan2(r.x - a.x, r.z - a.z);
          const k = calm ? 0 : 1;
          const hop = r.kind === 'dance' ? Math.abs(Math.sin(t * Math.PI * 2.2 + a.phase)) * 0.38 : r.kind === 'wave' ? Math.max(0, Math.sin(r.t * 9)) * 0.28 : Math.max(0, Math.sin(Math.min(1, r.t / 0.8) * Math.PI)) * 0.45;
          const sway = r.kind === 'dance' ? Math.sin(t * Math.PI * 1.1 + a.phase) * 0.6 : 0;
          const gy = ground(a.x, a.z);
          a.y += (gy - a.y) * Math.min(1, dt * 10 || 1);
          const far = Math.hypot(a.x - cam.x, a.z - cam.z) > HIDE;
          place(crowd.mesh, i, a.x, a.y + hop * k, a.z, face + sway * k, far ? 0 : 0.95);
          return;
        }
      }
      if (a.mode === 'lane') {
        if (a.pause > 0) a.pause -= dt;
        else {
          a.u += a.dir * a.speed * dt;
          if (a.u > 1 || a.u < 0) { a.dir *= -1; a.u = Math.max(0, Math.min(1, a.u)); a.pause = a.kind === 'skate' ? 0.2 : rnd() * 1.5; }
        }
        a.x = a.ax + (a.bx - a.ax) * a.u; a.z = a.az + (a.bz - a.az) * a.u;
        a.yaw = Math.atan2((a.bx - a.ax) * a.dir, (a.bz - a.az) * a.dir);
      } else if (a.mode === 'wander') {
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        if (a.pause > 0) a.pause -= dt;
        else if (d < 0.3 || !a.tx) {
          a.tx = a.box[0] + rnd() * (a.box[1] - a.box[0]); a.tz = a.box[2] + rnd() * (a.box[3] - a.box[2]);
          a.pause = rnd() * 2.5;
        } else { a.x += (dx / d) * a.speed * dt; a.z += (dz / d) * a.speed * dt; a.yaw = Math.atan2(dx, dz); }
      } else if (a.mode === 'loop') {
        a.s = (a.s + a.dir * a.speed * dt + L) % L;
        const [x, z, yaw] = at(a.s);
        const off = 0.7 * a.dir;
        const nx = Math.cos(yaw), nz = -Math.sin(yaw);
        a.x = x + nx * off; a.z = z + nz * off; a.yaw = a.dir > 0 ? yaw : yaw + Math.PI;
      }
      const moving = a.pause <= 0 || a.mode === 'loop';
      const gy = ground(a.x, a.z);
      a.y += (gy - a.y) * Math.min(1, dt * 10 || 1);
      const far = Math.hypot(a.x - cam.x, a.z - cam.z) > HIDE;
      const bob = moving && a.kind === 'walk' ? Math.abs(Math.sin(t * 7 + a.phase)) * 0.07 : 0;
      place(crowd.mesh, i, a.x, a.y + bob, a.z, a.yaw + (moving && a.kind === 'walk' ? Math.sin(t * 7 + a.phase) * 0.06 : 0), far ? 0 : 0.95);
    });
    crowd.mesh.instanceMatrix.needsUpdate = true;
    // the shuttle: round the loop, a few seconds at every stop
    if (busState.dwell > 0) busState.dwell -= dt;
    else {
      const before = busState.s;
      busState.s = (busState.s + busState.speed * dt) % L;
      for (const si of stopIdx) if ((before < si && busState.s >= si) || (before > busState.s && si <= busState.s)) busState.dwell = 3;
    }
    const [bx, bz, byaw] = at(busState.s);
    const nx = Math.cos(byaw), nz = -Math.sin(byaw);
    const x = bx + nx * 0.7, z = bz + nz * 0.7;
    busState.y += (ground(x, z) - busState.y) * Math.min(1, dt * 4 || 1);
    bus.position.set(x, busState.y + 0.5, z);
    bus.rotation.y = byaw - Math.PI / 2;
    bus.visible = Math.hypot(x - cam.x, z - cam.z) < HIDE + 40;
  }
  return { update, react, agents, bus };
}
