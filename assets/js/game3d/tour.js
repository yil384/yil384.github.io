// The scholar on tour: walks to wherever the page is pointing (a section's stand spot, or a spot the
// reader clicked). Shares the `player` object with the game, so the same voxel actor walks in both
// layers. If the way is blocked for too long the scholar blinks across instead of getting stuck.
import { player, markAction } from './player.js';
import * as fx from './fx.js';
import { reducedMotion } from '../three/env.js';
import { sfx } from './audio.js';

export function createTour(world) {
  let goal = null;
  let stuck = 0;
  let dashFx = 0;
  let warp = null;

  function canStand(x, z) {
    const hh = world.height(x, z);
    if (hh === -Infinity || world.isBlocked(x, z)) return false;
    return Math.abs(hh - world.height(player.x, player.z)) <= 1;
  }

  /** The nearest cell around (x, z) the scholar can actually stand on (walkable, not blocked). */
  function freeSpot(x, z) {
    const ok = (px, pz) => world.height(px, pz) > -Infinity && !world.isBlocked(px, pz);
    if (ok(x, z)) return { x, z };
    for (let r = 1; r <= 10; r += 0.5) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r, pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x: player.x, z: player.z };
  }

  function blink(x, z) {
    fx.burst(player.x, player.y + 1.2, player.z, '#a5b4fc', 14, 4, 0.5, 0.6);
    player.x = x; player.z = z; player.y = world.surfaceY(x, z);
    fx.burst(player.x, player.y + 1.2, player.z, '#c7d2fe', 14, 4, 0.5, 0.6);
    stuck = 0;
  }

  // 0-0.7 s charge (squash, rising sparks) · 0.7-0.95 s stretch and vanish · 0.95-2.05 s the beam arcs
  // over the island · 2.05-2.6 s land (drop in, squash, ring) · then hand back to the walker
  const CHARGE = 0.7, VANISH = 0.95, ARRIVE = 2.05, END = 2.6;
  function restoreScale() { if (warp && player.mesh) player.mesh.scale.setScalar(warp.base); }
  function arcPoint(u) {
    const { a, b } = warp;
    const ya = world.surfaceY(a.x, a.z), yb = world.surfaceY(b.x, b.z);
    const lift = 10 + Math.hypot(b.x - a.x, b.z - a.z) * 0.25;
    return { x: a.x + (b.x - a.x) * u, y: ya + (yb - ya) * u + 1.2 + Math.sin(u * Math.PI) * lift, z: a.z + (b.z - a.z) * u };
  }
  function updateWarp(dt) {
    const w = warp, m = player.mesh, base = w.base;
    w.t += dt;
    player.walking = false;
    const t = w.t;
    if (t < CHARGE) {
      const k = t / CHARGE;
      if (m) m.scale.set(base * (1 + 0.18 * k), base * (1 - 0.22 * k), base * (1 + 0.18 * k));
      w.trail -= dt;
      if (w.trail <= 0) { w.trail = 0.06; fx.burst(player.x + (Math.random() - 0.5) * 1.6, player.y + 0.2, player.z + (Math.random() - 0.5) * 1.6, '#c4b5fd', 2, 3, 0.6, 0.6); }
    } else if (t < VANISH) {
      const k = (t - CHARGE) / (VANISH - CHARGE);
      if (m) m.scale.set(base * (1 - 0.9 * k), base * (1 + 1.6 * k), base * (1 - 0.9 * k));
    } else if (t < ARRIVE) {
      if (m) m.scale.setScalar(0.0001);
      if (!w.launched) { w.launched = true; fx.burst(w.a.x, player.y + 1.2, w.a.z, '#e9d5ff', 22, 7, 0.6, 0.8); fx.ring(w.a.x, player.y + 0.1, w.a.z, '#fde68a', 3, 0.5); }
      const u = (t - VANISH) / (ARRIVE - VANISH), e = u * u * (3 - 2 * u);
      const p = arcPoint(e), q = arcPoint(Math.max(0, e - 0.06));
      fx.beam(q.x, q.y, q.z, p.x, p.y, p.z, '#fde68a', 0.22, 0.35);
      fx.burst(p.x, p.y, p.z, '#fef3c7', 2, 1.5, 0.45, 0.7);
      player.x = p.x; player.z = p.z; player.y = world.surfaceY(p.x, p.z);
    } else if (t < END) {
      if (!w.landed) {
        w.landed = true;
        player.x = w.b.x; player.z = w.b.z; player.y = world.surfaceY(w.b.x, w.b.z);
        if (w.face != null) player.yaw = w.face;
        fx.burst(player.x, player.y + 1.2, player.z, '#fde68a', 24, 6, 0.6, 0.8);
        fx.ring(player.x, player.y + 0.1, player.z, '#a78bfa', 3, 0.7);
        fx.shake(0.15, 160);
      }
      const k = (t - ARRIVE) / (END - ARRIVE);
      // drop in thin and tall, squash on landing, settle
      const sy = k < 0.4 ? 1.8 - 1.1 * (k / 0.4) : 0.7 + 0.3 * Math.min(1, (k - 0.4) / 0.6);
      const sx = k < 0.4 ? 0.4 + 0.9 * (k / 0.4) : 1.3 - 0.3 * Math.min(1, (k - 0.4) / 0.6);
      if (m) m.scale.set(base * sx, base * sy, base * sx);
    } else {
      restoreScale();
      const done = w.onLand;
      warp = null;
      done?.();
      if (w.pending) api.stand(...w.pending);
    }
    markAction();
  }

  const api = {
    get goal() { return goal; },
    get busy() { return !!warp || (!!goal && !goal.arrived); },
    get warping() { return !!warp; },
    /**
     * Teleport: appear at `from`, charge up, dissolve into a beam that arcs over the island, land at
     * `to` facing `face`. `onLand` runs on arrival. Reduced motion just places the scholar at `to`.
     */
    warp(from, to, face = null, onLand = null) {
      const a = freeSpot(from.x, from.z), b = freeSpot(to.x, to.z);
      if (reducedMotion.matches) { api.stand(b.x, b.z, face, { instant: true }); onLand?.(); return; }
      restoreScale();
      player.x = a.x; player.z = a.z; player.y = world.surfaceY(a.x, a.z);
      player.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      goal = { x: b.x, z: b.z, face, arrived: true };
      sfx('warp');
      warp = { t: 0, a, b, face, onLand, base: player.mesh?.scale.x || 0.22, trail: 0, landed: false };
      fx.ring(a.x, player.y + 0.1, a.z, '#a78bfa', 2.2, 0.8);
    },
    /** Stand at (x, z) and finish facing `face` (radians, optional). */
    stand(x, z, face = null, { instant = false } = {}) {
      if (warp && !instant) { warp.pending = [x, z, face]; return; } // walk on once the teleport lands
      if (warp) { restoreScale(); warp = null; }
      ({ x, z } = freeSpot(x, z));
      if (instant || reducedMotion.matches) { player.x = x; player.z = z; player.y = world.surfaceY(x, z); if (face != null) player.yaw = face; goal = { x, z, face, arrived: true }; return; }
      goal = { x, z, face, arrived: false };
      stuck = 0;
    },
    update(dt) {
      if (warp) { updateWarp(dt); return; }
      if (!goal) { player.walking = false; return; }
      const dx = goal.x - player.x, dz = goal.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) {
        goal.arrived = true;
        player.walking = false;
        if (goal.face != null) {
          let dy = ((goal.face - player.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
          player.yaw += dy * Math.min(1, dt * 8);
        }
        return;
      }
      goal.arrived = false;
      const speed = Math.min(30, Math.max(9, d * 1.5));
      const step = Math.min(d, speed * dt);
      let moved = false;
      for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
        const a = Math.atan2(dx, dz) + turn;
        const nx = player.x + Math.sin(a) * step, nz = player.z + Math.cos(a) * step;
        if (canStand(nx, nz)) { player.x = nx; player.z = nz; player.yaw = a; moved = true; break; }
        if (canStand(nx, player.z)) { player.x = nx; player.yaw = a; moved = true; break; }
        if (canStand(player.x, nz)) { player.z = nz; player.yaw = a; moved = true; break; }
      }
      player.walking = moved;
      if (moved) {
        stuck = Math.max(0, stuck - dt);
        markAction();
        if (speed > 14) { dashFx -= dt; if (dashFx <= 0) { dashFx = 0.05; fx.burst(player.x, player.y + 0.4, player.z, '#c7d2fe', 1, 1.5, 0.35, 0.5); } }
      } else stuck += dt;
      if (stuck > 1.1) blink(goal.x, goal.z);
      player.t += dt * (player.walking ? 8 + speed * 0.25 : 2);
    },
  };
  return api;
}
