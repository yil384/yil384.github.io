// One camera for both layers of the site.
//   tour: flies between authored shots (look-at point, yaw, pitch, distance, screen offset) as the
//         page scrolls; the pointer adds a little parallax.
//   play: third-person follow. Right-drag orbits, wheel zooms; the target is the player.
// Both modes steer the same damped "current" pose toward a "wanted" pose, so entering or leaving
// play is a glide rather than a cut.
import * as THREE from 'three/webgpu';
import { reducedMotion } from '../three/boot.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

const PLAY = { pitch: 0.95, dist: 24, fov: 42 };

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  const cur = { look: new THREE.Vector3(0, 3, 0), yaw: 0.35, pitch: 0.5, dist: 60, shiftX: 0, shiftY: 0, fov: 38 };
  const want = { look: new THREE.Vector3(0, 3, 0), yaw: 0.35, pitch: 0.5, dist: 60, shiftX: 0, shiftY: 0, fov: 38 };
  const pos = new THREE.Vector3();
  const size = { w: 1, h: 1 };
  let play = false;
  let lastFov = 0, lastSx = NaN, lastSy = NaN, lastW = 0, lastH = 0;

  const state = {
    cam,
    cur,
    want,
    tourRate: 2.2,                 // 1/s: how quickly the tour camera settles onto a shot
    pointer: { x: 0, y: 0 },       // -1..1, set by the director
    get yaw() { return cur.yaw; },
    set yaw(v) { cur.yaw = want.yaw = v; },
    get pitch() { return cur.pitch; },
    set pitch(v) { cur.pitch = want.pitch = v; },
    get dist() { return cur.dist; },
    set dist(v) { cur.dist = want.dist = v; },
    get look() { return cur.look; },
    get playing() { return play; },
    resize(w, h) { size.w = w; size.h = h; },

    /** Aim the tour camera at a shot: { look:[x,y,z], yaw, pitch, dist, shiftX, shiftY, fov }. */
    shot(s) {
      want.look.set(s.look[0], s.look[1], s.look[2]);
      want.yaw = s.yaw;
      want.pitch = s.pitch;
      want.dist = s.dist;
      want.shiftX = s.shiftX || 0;
      want.shiftY = s.shiftY || 0;
      want.fov = s.fov || 38;
    },
    /** Start from an arbitrary pose (used by the opening fly-in). */
    jump(s) {
      cur.look.set(s.look[0], s.look[1], s.look[2]);
      cur.yaw = s.yaw; cur.pitch = s.pitch; cur.dist = s.dist;
      cur.shiftX = s.shiftX || 0; cur.shiftY = s.shiftY || 0; cur.fov = s.fov || 38;
      place();
    },
    /** Land on the wanted pose immediately. */
    settle() {
      cur.look.copy(want.look);
      cur.yaw = want.yaw; cur.pitch = want.pitch; cur.dist = want.dist;
      cur.shiftX = want.shiftX; cur.shiftY = want.shiftY; cur.fov = want.fov;
      place();
    },
    setPlay(on, p) {
      play = on;
      if (on) {
        want.pitch = PLAY.pitch;
        want.dist = PLAY.dist;
        want.fov = PLAY.fov;
        want.shiftX = 0; want.shiftY = 0;
        // keep the yaw the reader is already looking along so WASD feels natural
        want.yaw = cur.yaw;
        if (p) want.look.set(p.x, p.y + 1.5, p.z);
      }
    },
    snap(p) {
      cur.look.set(p.x, p.y + 1.5, p.z);
      want.look.copy(cur.look);
      place();
    },
    update(p, input, dt, t = 0) {
      let rate;
      if (play) {
        const d = input?.drag();
        if (d) { want.yaw -= d.dx * 0.006; want.pitch = clamp(want.pitch - d.dy * 0.004, 0.45, 1.35); }
        const w = input?.wheel();
        if (w) want.dist = clamp(want.dist * (1 + w * 0.0012), 12, 40);
        want.look.set(p.x, p.y + 1.5, p.z);
        rate = 6;
      } else {
        rate = reducedMotion.matches ? 60 : state.tourRate;
      }
      const k = 1 - Math.exp(-rate * dt);
      cur.look.lerp(want.look, k);
      cur.yaw += wrap(want.yaw - cur.yaw) * k;
      cur.pitch += (want.pitch - cur.pitch) * k;
      cur.dist += (want.dist - cur.dist) * k;
      cur.shiftX += (want.shiftX - cur.shiftX) * k;
      cur.shiftY += (want.shiftY - cur.shiftY) * k;
      cur.fov += (want.fov - cur.fov) * k;
      place(t);
    },
  };

  function place(t = 0) {
    let { yaw, pitch } = cur;
    if (!play && !reducedMotion.matches) {
      yaw += state.pointer.x * 0.05 + Math.sin(t * 0.11) * 0.025;
      pitch += -state.pointer.y * 0.025 + Math.sin(t * 0.09 + 1) * 0.008;
    }
    const cp = Math.cos(pitch);
    pos.set(cur.look.x + Math.sin(yaw) * cp * cur.dist, cur.look.y + Math.sin(pitch) * cur.dist, cur.look.z + Math.cos(yaw) * cp * cur.dist);
    cam.position.copy(pos);
    cam.lookAt(cur.look);
    const dirty = Math.abs(cur.fov - lastFov) > 1e-3 || cur.shiftX !== lastSx || cur.shiftY !== lastSy || size.w !== lastW || size.h !== lastH;
    if (dirty) {
      lastFov = cur.fov; lastSx = cur.shiftX; lastSy = cur.shiftY; lastW = size.w; lastH = size.h;
      cam.fov = cur.fov;
      cam.aspect = size.w / size.h;
      if (Math.abs(cur.shiftX) > 1e-4 || Math.abs(cur.shiftY) > 1e-4) cam.setViewOffset(size.w, size.h, -cur.shiftX * size.w, -cur.shiftY * size.h, size.w, size.h);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
  }

  return state;
}
