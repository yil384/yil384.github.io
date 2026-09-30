// Player movement in play mode (on foot). Velocity based, camera relative.
//   jump     Space: coyote time (you can still jump just after walking off a ledge), jump buffering
//            (a press just before landing still jumps), variable height (release early = short hop)
//   step-up  walking climbs 1-block steps on its own; a hop gets you onto 2-block ledges
//   sprint   Shift
//   dodge    K, or double-tap a direction: a quick roll with invulnerability frames
//   glide    hold Space while falling, once the Torrey Pines glider is unlocked
// Falling off an island never hurts: `onFallOut` brings the player back to the region's spawn.
// Vehicles (vehicles.js) take over while one is active.
import { player, markAction, moveSpeed } from './player.js';
import { clock } from './clock.js';
import { S } from './state.js';
import { emit } from './bus.js';
import { sfx } from './audio.js';
import * as fx from './fx.js';

export const TUNING = {
  gravity: 34, fallMult: 1.4, jumpV: 11.2, jumpCut: 0.5,
  stepUp: 1.05,            // auto step height while walking (voxels)
  coyote: 0.11, buffer: 0.14,
  accelGround: 16, accelAir: 6,
  sprint: 1.55,
  dodgeSpeed: 19, dodgeTime: 0.3, dodgeCd: 0.5, dodgeIframes: 380,
  glideFall: 2.4,
  fallOutY: -16,           // below this (world y) you are brought back
};

export const lerpAngle = (a, b, k) => a + ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * k;

export function initMoveState() {
  Object.assign(player, {
    vx: 0, vy: 0, vz: 0, grounded: true, coyoteT: 0, bufferT: 0, jumpCut: false, airT: 0,
    dodgeT: 0, dodgeCd: 0, dodgeX: 0, dodgeZ: 0, gliding: false, sprinting: false, vehicle: null, roll: 0,
  });
}

/**
 * @param {{ world, input, rig, onFallOut: () => void }} deps
 */
export function createMover({ world, input, rig, onFallOut }) {
  let dustT = 0;

  /** Can the player's feet move into (x, z)? Steps up to `step`, any drop, never into blocked cells. */
  function canEnter(x, z, step) {
    if (world.isBlocked(x, z)) return false;
    const g = world.height(x, z);
    if (g === -Infinity) return true;               // off the edge: allowed, you will fall
    return g + 0.5 <= player.y + step;
  }

  /** Camera-relative input direction in world space (length 0..1). */
  function wish() {
    const v = input.axis();
    const yaw = rig.yaw;
    return { x: v.x * Math.cos(yaw) + v.y * Math.sin(yaw), z: -v.x * Math.sin(yaw) + v.y * Math.cos(yaw), mag: Math.hypot(v.x, v.y) };
  }

  function tryDodge(dir) {
    if (player.dodgeCd > 0 || player.dead) return;
    let dx = dir?.x ?? 0, dz = dir?.z ?? 0;
    const l = Math.hypot(dx, dz);
    if (l < 0.2) { dx = Math.sin(player.yaw); dz = Math.cos(player.yaw); } else { dx /= l; dz /= l; }
    player.dodgeX = dx; player.dodgeZ = dz;
    player.dodgeT = TUNING.dodgeTime;
    player.dodgeCd = TUNING.dodgeTime + TUNING.dodgeCd;
    player.invulnUntil = Math.max(player.invulnUntil, clock.t + TUNING.dodgeIframes);
    player.yaw = Math.atan2(dx, dz);
    sfx('swing');
    fx.burst(player.x, player.y + 0.3, player.z, '#c7d2fe', 8, 3, 0.35, 0.6);
    markAction();
    emit('player:dodge');
  }

  function step(dt) {
    const T = TUNING;
    const w = wish();
    player.dodgeCd = Math.max(0, player.dodgeCd - dt);

    // ---- dodge
    const dt2 = input.takeDoubleTap();
    if (input.pressed('KeyK') || input.pressed('Dodge')) tryDodge(w.mag > 0.2 ? w : null);
    else if (dt2) {
      const yaw = rig.yaw;
      tryDodge({ x: dt2[0] * Math.cos(yaw) + dt2[1] * Math.sin(yaw), z: -dt2[0] * Math.sin(yaw) + dt2[1] * Math.cos(yaw) });
    }

    // ---- horizontal velocity
    let speed = moveSpeed();
    player.sprinting = input.sprint() && w.mag > 0.2;
    if (player.sprinting) speed *= T.sprint;
    let tvx = w.x * speed, tvz = w.z * speed;
    let k = 1 - Math.exp(-(player.grounded ? T.accelGround : T.accelAir) * dt);
    if (player.dodgeT > 0) {
      player.dodgeT -= dt;
      const e = Math.max(0, player.dodgeT / T.dodgeTime);
      const s = speed + (T.dodgeSpeed - speed) * e;
      tvx = player.dodgeX * s; tvz = player.dodgeZ * s;
      k = 1;
      player.roll = (1 - e) * Math.PI * 2;
    } else player.roll = 0;
    player.vx += (tvx - player.vx) * k;
    player.vz += (tvz - player.vz) * k;
    if (Math.abs(player.vx) < 0.01) player.vx = 0;
    if (Math.abs(player.vz) < 0.01) player.vz = 0;

    // ---- move, one axis at a time (slide along walls)
    const step = T.stepUp;
    const nx = player.x + player.vx * dt;
    if (canEnter(nx, player.z, step)) player.x = nx; else player.vx = 0;
    const nz = player.z + player.vz * dt;
    if (canEnter(player.x, nz, step)) player.z = nz; else player.vz = 0;
    const hs = Math.hypot(player.vx, player.vz);
    if (rig.firstPerson) player.yaw = rig.yaw + Math.PI;           // first person: the body faces the view
    else if (hs > 0.3 && player.dodgeT <= 0) player.yaw = lerpAngle(player.yaw, Math.atan2(player.vx, player.vz), 1 - Math.exp(-14 * dt));
    if (hs > 0.3) markAction();

    // ---- jump (buffer + coyote + variable height)
    if (input.pressed('Space')) player.bufferT = T.buffer;
    else player.bufferT = Math.max(0, player.bufferT - dt);
    if (player.bufferT > 0 && (player.grounded || player.coyoteT > 0) && !player.dead) {
      player.vy = T.jumpV;
      player.grounded = false;
      player.coyoteT = 0;
      player.bufferT = 0;
      player.jumpCut = false;
      player.airT = 0;
      fx.burst(player.x, player.y + 0.2, player.z, '#e2e8f0', 5, 2.5, 0.3, 0.5);
      emit('player:jump');
    }
    if (!input.down('Space') && player.vy > 0 && !player.jumpCut) { player.vy *= T.jumpCut; player.jumpCut = true; }

    // ---- vertical
    const gh = world.height(player.x, player.z);
    const ground = gh === -Infinity ? -Infinity : gh + 0.5;
    if (player.grounded) {
      if (ground === -Infinity || ground < player.y - T.stepUp) { player.grounded = false; player.coyoteT = T.coyote; player.vy = 0; player.airT = 0; }
      else { player.y = ground; player.vy = 0; }
    }
    player.gliding = false;
    if (!player.grounded) {
      player.airT += dt;
      player.coyoteT = Math.max(0, player.coyoteT - dt);
      player.vy -= T.gravity * (player.vy < 0 ? T.fallMult : 1) * dt;
      if (S.world?.glider && input.down('Space') && player.vy < 0 && player.airT > 0.18) {
        player.gliding = true;
        player.vy = Math.max(player.vy, -T.glideFall);
      }
      player.y += player.vy * dt;
      if (ground > -Infinity && player.y <= ground) {
        const impact = -player.vy;
        player.y = ground;
        player.vy = 0;
        player.grounded = true;
        if (impact > 13) { fx.burst(player.x, player.y + 0.1, player.z, '#cbd5e1', 10, 4, 0.4, 0.6); fx.shake(0.12, 120); }
        emit('player:land', impact);
      }
      if (player.y < TUNING.fallOutY) { player.vy = 0; onFallOut(); }
    }

    // ---- sprint dust + walk cycle
    player.walking = player.grounded && hs > 0.8;
    if (player.sprinting && player.walking) { dustT -= dt; if (dustT <= 0) { dustT = 0.1; fx.burst(player.x, player.y + 0.15, player.z, '#cbd5e1', 1, 1.5, 0.35, 0.55); } }
    player.t += dt * (player.walking ? 5 + hs * 0.35 : 2);
  }

  return { step, tryDodge, canEnter, wish };
}
