// One camera for both layers of the site.
//   tour: flies between authored shots (look-at point, yaw, pitch, distance, screen offset) as the
//         page scrolls; the pointer adds a little parallax.
//   play: mouse look. Pointer lock (click the world) or right-drag turns the view; the wheel zooms the
//         third-person distance, and zooming all the way in (or C / F5) switches to first person.
//         The follow is critically damped (1 - exp(-k·dt)), so it is frame-rate independent and never
//         snaps; the orbit is pulled in whenever thick ground (terrain, a run of blocked cells) would come
//         between the camera and the player, or the camera would end up inside it. Thin things in the way
//         (tree crowns, lamps, props, one-cell walls) are not zoomed for: cutout.js dithers them away.
// Both modes steer the same damped "current" pose toward a "wanted" pose, so entering or leaving
// play is a glide rather than a cut.
import * as THREE from 'three/webgpu';
import { reducedMotion } from '../three/boot.js';
import { cut } from './cutout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

/** Mouse-look sensitivity, radians per pixel (pointer lock / drag). Touch uses 1.6× this. */
export const LOOK_SENS = 0.0042;
export const PLAY = { pitch: 0.62, dist: 17, fov: 60, minDist: 6, maxDist: 42, fpFov: 72 };
const EYE = 3.15;              // first-person eye height above the feet (top of the head)
const FOLLOW = 14, FOLLOW_Y = 9, TURN = 30, ZOOM = 10;

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(38, 1, 0.3, 700);
  const cur = { look: new THREE.Vector3(0, 3, 0), yaw: 0.35, pitch: 0.5, dist: 60, shiftX: 0, shiftY: 0, fov: 38 };
  const want = { look: new THREE.Vector3(0, 3, 0), yaw: 0.35, pitch: 0.5, dist: 60, shiftX: 0, shiftY: 0, fov: 38 };
  const pos = new THREE.Vector3();
  const size = { w: 1, h: 1 };
  let play = false;
  let fp = false;                 // first person
  let fpPitch = 0.12;             // first-person pitch (+ looks down)
  let tpDist = PLAY.dist;         // remembered third-person distance
  let ground = null;              // (x, z) -> surface y, for camera collision
  let floor = null;               // (x, z) -> bare terrain y (no props), for the minimum camera height
  let occ = null;                 // eased camera distance after occlusion pull-in
  let occHold = 0, lift = 0;
  let occPitch = 0;               // extra pitch while a wall behind the player leaves no room: look from above instead
  let near = false;               // the camera ended up very close to the player (index.js hides the model)
  const TP_MIN = 2.8;             // third person never comes closer than this (the head, the backpack…)
  const LENS = 0.45;              // room kept around the lens (blocked columns)
  let frameDt = 0.016;
  const occDt = () => { const d = frameDt; frameDt = 0; return d; }; // consumed once per update
  let lastFov = 0, lastSx = NaN, lastSy = NaN, lastW = 0, lastH = 0;
  let motion = 0;                 // how much the pose changed last update (for the tour frame cap)
  let lookIdle = 99;              // seconds since the last manual look input (auto-follow waits for it)
  const prev = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 0 };
  let dive = null;                // { t, dur }: entering play from the page, a slow glide down to the scholar
  let cine = null;                // { t, dur, look, yaw, pitch, dist, back }: a scripted shot in play

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
    get firstPerson() { return fp; },
    /** Change in pose during the last update (world units + radians); ~0 when the camera is at rest. */
    get motion() { return motion; },
    get debug() { return { occ, lift, occPitch, dist: cur.dist, want: want.dist, look: cur.look }; },
    /** Third person and the camera sits right behind the head: hide the player model instead of filling the view with it. */
    get tooClose() { return near; },
    resize(w, h) { size.w = w; size.h = h; },
    setGround(fn, floorFn = null) { ground = fn; floor = floorFn; },

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
        want.dist = tpDist;
        want.fov = PLAY.fov;
        want.shiftX = 0; want.shiftY = 0;
        want.yaw = cur.yaw;       // keep the yaw the reader is already looking along
        if (p) want.look.set(p.x, p.y + 1.6, p.z);
      } else if (fp) state.setFirstPerson(false);
    },
    /** First person on/off (C, F5, or zooming all the way in). */
    setFirstPerson(on) {
      if (on === fp) return;
      fp = on;
      if (on) { fpPitch = clamp(want.pitch - 0.55, -0.5, 0.6); want.fov = PLAY.fpFov; }
      else { want.pitch = clamp(fpPitch + 0.55, 0.15, 1.3); want.dist = tpDist = Math.max(tpDist, PLAY.minDist + 4); want.fov = PLAY.fov; }
    },
    toggleView() { state.setFirstPerson(!fp); },
    /** Glide from wherever the camera is to the play pose over `seconds` (entering from the page). */
    dive(seconds = 1.2) { dive = reducedMotion.matches ? null : { t: 0, dur: seconds }; },
    /** Hold a scripted pose for `seconds` (boss intros, cutscenes): { x, y, z, yaw?, pitch, dist }. */
    cinematic(pose, seconds = 2.5) {
      cine = { t: 0, dur: seconds, look: new THREE.Vector3(pose.x, pose.y, pose.z), yaw: pose.yaw ?? want.yaw, pitch: pose.pitch ?? 0.4, dist: pose.dist ?? 18, back: { yaw: want.yaw, pitch: want.pitch, dist: want.dist, fp } };
      if (fp) state.setFirstPerson(false);
    },
    get inCinematic() { return !!cine; },
    /** Jump straight to the player (after a teleport). */
    snap(p) {
      cur.look.set(p.x, p.y + 1.6, p.z);
      want.look.copy(cur.look);
      cur.yaw = want.yaw; cur.pitch = want.pitch; cur.dist = want.dist;
      place();
    },
    /** Point the camera along a heading (e.g. behind a vehicle). `k` 0..1 blends toward it. */
    follow(yaw, k = 1) { if (lookIdle > 0.8) want.yaw += wrap(yaw - want.yaw) * k; },
    /**
     * @param p      the player { x, y, z }
     * @param input  play input (look deltas, wheel) or null in tour
     * @param opts   { eye?: {x,y,z} override for first person (vehicles), sens }
     */
    update(p, input, dt, t = 0, opts = {}) {
      frameDt = dt;
      prev.x = cam.position.x; prev.y = cam.position.y; prev.z = cam.position.z;
      prev.yaw = cur.yaw; prev.pitch = cur.pitch; prev.fov = cur.fov;
      if (play && cine) {
        cine.t += dt;
        want.look.copy(cine.look); want.yaw = cine.yaw; want.pitch = cine.pitch; want.dist = cine.dist;
        input?.drag(); input?.wheel();
        const k = 1 - Math.exp(-3 * dt);
        cur.look.lerp(want.look, k);
        cur.yaw += wrap(want.yaw - cur.yaw) * k; cur.pitch += (want.pitch - cur.pitch) * k; cur.dist += (want.dist - cur.dist) * k; cur.fov += (want.fov - cur.fov) * k;
        if (cine.t >= cine.dur) { want.yaw = cine.back.yaw; want.pitch = cine.back.pitch; want.dist = cine.back.dist; if (cine.back.fp) state.setFirstPerson(true); cine = null; }
      } else if (play) {
        lookIdle += dt;
        const d = input?.drag();
        if (d) {
          lookIdle = 0;
          want.yaw -= d.dx * LOOK_SENS * (d.touch ? 1.6 : 1);
          if (fp) fpPitch = clamp(fpPitch + d.dy * LOOK_SENS, -1.35, 1.35);
          else want.pitch = clamp(want.pitch + d.dy * LOOK_SENS, 0.05, 1.35);
        }
        const w = input?.wheel();
        if (w) {
          if (fp && w > 0) { state.setFirstPerson(false); want.dist = tpDist = PLAY.minDist + 1; }
          else if (!fp) {
            const nd = want.dist * (1 + w * 0.0012);
            if (nd < PLAY.minDist) state.setFirstPerson(true);
            else want.dist = tpDist = clamp(nd, PLAY.minDist, PLAY.maxDist);
          }
        }
        const eye = opts.eye;
        want.look.set(p.x, p.y + (fp ? (eye ? 0 : EYE) : 1.6), p.z);
        if (eye) want.look.set(eye.x, eye.y, eye.z);
        let m = 1;
        if (dive) { dive.t += dt; const e = Math.min(1, dive.t / dive.dur); m = 0.08 + 0.92 * e * e; if (e >= 1) dive = null; }
        const kt = 1 - Math.exp(-TURN * m * dt);
        const kf = fp ? 1 - Math.exp(-40 * m * dt) : 1 - Math.exp(-FOLLOW * m * dt);
        const ky = fp ? kf : 1 - Math.exp(-FOLLOW_Y * m * dt);
        cur.look.x += (want.look.x - cur.look.x) * kf;
        cur.look.z += (want.look.z - cur.look.z) * kf;
        cur.look.y += (want.look.y - cur.look.y) * ky;
        cur.yaw += wrap(want.yaw - cur.yaw) * kt;
        cur.pitch += (want.pitch - cur.pitch) * kt;
        const kz = 1 - Math.exp(-ZOOM * m * dt);
        cur.dist += (want.dist - cur.dist) * kz;
        cur.fov += (want.fov - cur.fov) * kz;
        cur.shiftX += (want.shiftX - cur.shiftX) * kz;
        cur.shiftY += (want.shiftY - cur.shiftY) * kz;
      } else {
        const rate = reducedMotion.matches ? 60 : state.tourRate;
        const k = 1 - Math.exp(-rate * dt);
        cur.look.lerp(want.look, k);
        cur.yaw += wrap(want.yaw - cur.yaw) * k;
        cur.pitch += (want.pitch - cur.pitch) * k;
        cur.dist += (want.dist - cur.dist) * k;
        cur.shiftX += (want.shiftX - cur.shiftX) * k;
        cur.shiftY += (want.shiftY - cur.shiftY) * k;
        cur.fov += (want.fov - cur.fov) * k;
      }
      place(t);
      motion = Math.hypot(cam.position.x - prev.x, cam.position.y - prev.y, cam.position.z - prev.z)
        + Math.abs(cur.yaw - prev.yaw) * 20 + Math.abs(cur.pitch - prev.pitch) * 20 + Math.abs(cur.fov - prev.fov);
    },
  };

  const _dir = new THREE.Vector3();
  function place(t = 0) {
    let { yaw, pitch } = cur;
    if (play && fp) {
      // first person: stand at the eye, look along yaw / fpPitch
      cam.position.copy(cur.look);
      _dir.set(-Math.sin(yaw) * Math.cos(fpPitch), -Math.sin(fpPitch), -Math.cos(yaw) * Math.cos(fpPitch));
      cam.lookAt(cam.position.x + _dir.x, cam.position.y + _dir.y, cam.position.z + _dir.z);
      near = false;
    } else {
      if (!play && !reducedMotion.matches) {
        yaw += state.pointer.x * 0.05 + Math.sin(t * 0.11) * 0.025;
        pitch += -state.pointer.y * 0.025 + Math.sin(t * 0.09 + 1) * 0.008;
      }
      let dist = cur.dist;
      // keep terrain out from between the camera and the player: march outward, pull in on a hit.
      // A single-cell hit (a lamp, a sign, a bench) is ignored so small props don't yank the camera;
      // the pull-in eases (fast in, slow back out) instead of snapping.
      const pdt = Math.min(occDt(), 0.1);
      if (play && ground) {
        // how far back the camera can sit along this pitch before terrain gets in the way. A short hit in
        // the middle (a trunk, a lamp, a one-cell wall: < 1.4 units along the ray) is left to the cutout;
        // a longer one, or one the camera itself would sit in (the back to a wall), brings it in front.
        // (the lens gets some room: a blocked column within ~0.45 of it counts, so walking past a corner
        // starts the dolly before the camera would be inside, instead of a snap)
        const wallAt = (x, z, y) => { const gy = ground(x, z); return gy > y - 0.6 && (!floor || gy > floor(x, z) + 0.5); };
        const reach = (pt) => {
          const c = Math.cos(pt), sx = Math.sin(yaw) * c, sy = Math.sin(pt), sz = Math.cos(yaw) * c;
          let first = -1;
          for (let s = 1.5; ; s += 0.5) {
            const end = s >= dist;
            if (end) s = dist;
            const x = cur.look.x + sx * s, y = cur.look.y + sy * s, z = cur.look.z + sz * s;
            if (ground(x, z) > y - 0.6 || (end && (wallAt(x + LENS, z, y) || wallAt(x - LENS, z, y) || wallAt(x, z + LENS, y) || wallAt(x, z - LENS, y)))) {
              if (first < 0) first = s;
              else if (s - first >= 1.4) return Math.max(1.2, first - 0.8);
            } else first = -1;
            if (end) break;
          }
          return first >= 0 ? Math.max(1.2, first - 0.8) : dist;
        };
        let want = reach(pitch);
        // no room behind (a wall, a cliff, a slope): rather than sliding into the head and backpack, rise
        // and look down from over the obstacle; only if even that is blocked does the camera come in
        let lift2 = 0;
        if (want < Math.min(dist, 6)) {
          for (const pt of [0.95, 1.15, 1.35, 1.45]) {
            if (pt <= pitch) continue;
            const r = reach(pt);
            if (r > want + 1) { want = r; lift2 = pt - pitch; }
            if (r >= Math.min(dist, 6)) break;
          }
        }
        occPitch += (lift2 - occPitch) * (1 - Math.exp(-(lift2 > occPitch ? 8 : 2.5) * pdt));
        want = Math.max(want, Math.min(dist, TP_MIN));
        if (occ == null || occ > dist) occ = dist;
        // hysteresis: once pulled in, hold for a moment before easing back out, so a ray grazing an
        // edge (hit, miss, hit…) doesn't pump the distance every frame
        // (coming in is fast but capped at ~80 units/s, so a wall stepping into the ray is a quick dolly
        // rather than a one-frame cut; the cutout keeps the scholar in sight meanwhile)
        if (want < occ - 0.05) { occHold = 0.45; occ += Math.max((want - occ) * (1 - Math.exp(-12 * pdt)), -80 * pdt); }
        else if ((occHold -= pdt) <= 0) occ += (want - occ) * (1 - Math.exp(-2.5 * pdt));
        dist = Math.min(dist, occ);
      } else { occ = null; lift = 0; occPitch = 0; }
      const pt = Math.min(1.45, pitch + occPitch), cq = Math.cos(pt);
      const ox = Math.sin(yaw) * cq, oy = Math.sin(pt), oz = Math.cos(yaw) * cq;
      // the eased pose can still end inside a blocked column (pitch and distance are mid-glide): step in along
      // the actual ray until the lens is clear, and hold that as the pulled-in distance
      if (play && ground && floor) {
        const inside = (s) => { const x = cur.look.x + ox * s, z = cur.look.z + oz * s; return ground(x, z) > floor(x, z) + 0.5 && ground(x, z) > cur.look.y + oy * s - 0.6; };
        if (inside(dist)) {
          let s = dist;
          while (s > TP_MIN && inside(s)) s -= 0.25;
          dist = Math.max(TP_MIN, s);
          if (occ != null) { occ = Math.min(occ, dist); occHold = Math.max(occHold, 0.6); }
        }
      }
      pos.set(cur.look.x + ox * dist, cur.look.y + oy * dist, cur.look.z + oz * dist);
      // stay above the ground, eased: terrain height steps a whole block per cell, and snapping to it
      // made the camera hop up and down while walking over uneven ground
      if (play && ground) {
        const gy = (floor || ground)(pos.x, pos.z);
        const need = Math.max(0, gy + 0.9 - pos.y);
        lift += (need - lift) * (1 - Math.exp(-(need > lift ? 12 : 4) * pdt));
        pos.y += lift;
        if (pos.y < gy + 0.3) pos.y = gy + 0.3; // never inside the ground
      }
      cam.position.copy(pos);
      cam.lookAt(cur.look);
      near = play && cam.position.distanceTo(cur.look) < TP_MIN + 0.4;
    }
    // the see-through cone (cutout.js): third person in play only; tour shots and first person are untouched
    const camL = cam.position.distanceTo(cur.look);
    cut.on.value = play && !fp && !cine && camL > 1 ? 1 : 0;
    if (cut.on.value) {
      cut.target.value.copy(cur.look);
      cut.feet.value = cur.look.y - 1.6;
      cut.end.value = Math.max(0, 1 - 0.55 / camL);   // stop just short of the body (~0.5 wide)
      cut.fe.value = 0.35 / camL;
    }
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
