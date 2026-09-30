// The scholar on tour: walks to wherever the page is pointing (a section's stand spot, or a spot the
// reader clicked). Shares the `player` object with the game, so the same voxel actor walks in both
// layers. If the way is blocked for too long the scholar blinks across instead of getting stuck.
import { player, markAction } from './player.js';
import * as fx from './fx.js';

export function createTour(world) {
  let goal = null;
  let stuck = 0;
  let dashFx = 0;

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

  const api = {
    get goal() { return goal; },
    get busy() { return !!goal && !goal.arrived; },
    /** Stand at (x, z) and finish facing `face` (radians, optional). */
    stand(x, z, face = null, { instant = false } = {}) {
      ({ x, z } = freeSpot(x, z));
      if (instant) { player.x = x; player.z = z; player.y = world.surfaceY(x, z); if (face != null) player.yaw = face; goal = { x, z, face, arrived: true }; return; }
      goal = { x, z, face, arrived: false };
      stuck = 0;
    },
    update(dt) {
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
