// The virtual camera: a 720x720 window over the 1280x720 source (centre cx/cy in source px, zoom z, roll in radians),
// driven by the subject track (heavily smoothed within each shot, never across the hard cut) plus authored beats.
import { SRC_W, SRC_H, SIZE, FPS, OFFSET, CLIP_END, OUTRO_FRAME, B, clamp, lerp, inOut, outCubic, ramp, wob, srcIndex } from './timeline.js';

let T = null;
let heavy = null; // per source frame: { hx, hy, cx } in source px, smoothed hard (sigma ~10 frames) within each shot

export function initCamera(track) {
  T = track;
  const n = track.frames, cut = track.cut;
  const shots = [[0, cut], [cut, n]];
  const raw = track.f.map((f) => ({ hx: f.head[0] * SRC_W, hy: f.head[1] * SRC_H, cx: f.c[0] * SRC_W }));
  heavy = new Array(n);
  const sigma = 10, R = 30;
  for (const [a, b] of shots) {
    for (let i = a; i < b; i++) {
      let w = 0; const s = { hx: 0, hy: 0, cx: 0 };
      for (let k = Math.max(a, i - R); k <= Math.min(b - 1, i + R); k++) {
        const g = Math.exp(-((k - i) ** 2) / (2 * sigma * sigma));
        w += g; s.hx += raw[k].hx * g; s.hy += raw[k].hy * g; s.cx += raw[k].cx * g;
      }
      heavy[i] = { hx: s.hx / w, hy: s.hy / w, cx: s.cx / w };
    }
  }
  B.cut = OFFSET + cut / FPS;
}

// fractional source position sampled smoothly (so the camera moves at sub-frame precision between source frames)
function heavyAt(t) {
  const si = srcIndex(t);
  return heavy[si];
}

// decaying punch (overshooting spring): 0 before t0, peaks right after, settles by ~0.5 s
function punch(t, t0) {
  const k = t - t0;
  if (k < 0) return 0;
  return Math.exp(-k / 0.16) * Math.sin(Math.min(k / 0.07, 1) * Math.PI / 2 + Math.max(0, k - 0.07) * 9);
}
function shake(t, t0, seed) {
  const k = t - t0;
  if (k < 0 || k > 0.45) return [0, 0];
  const e = Math.exp(-k / 0.1);
  return [wob(t, seed, 9) * e, wob(t, seed + 7, 9) * e];
}

export function cameraAt(t) {
  let cx, cy, z, roll = 0, sh = [0, 0];
  const cutT = B.cut;
  if (t < cutT) {
    // close-up: head in the upper third, left of centre (room for balloons and captions on the right)
    const h = heavyAt(t), h0 = heavy[0];
    const follow = t < OFFSET ? 0 : clamp((t - OFFSET) / 1.2);
    const hx = lerp(h0.hx, h.hx, 0.75 * follow), hy = lerp(h0.hy, h.hy, 0.75 * follow);
    z = lerp(1.0, 1.06, inOut(t / B.aliveEnd));
    z = lerp(z, 1.13, inOut(ramp(t, B.aliveEnd, cutT)));
    z += 0.055 * punch(t, B.name);
    const sx = lerp(0.42, 0.25, inOut(ramp(t, 0.6, 2.1)));
    const sy = 0.3;
    cx = hx + (0.5 - sx) * SIZE / z;
    cy = hy + (0.5 - sy) * SIZE / z;
    const s1 = shake(t, B.name, 11);
    sh = [s1[0] * 7, s1[1] * 7];
  } else if (t < CLIP_END) {
    // wide shot: full height, gentle push in on the line, back out for SHING (the blade reaches the left edge),
    // a slight push + roll wobble for the spin, then a slow push in on the final pose
    const h = heavyAt(t);
    z = 1.0 + 0.06 * inOut(ramp(t, cutT + 0.3, 6.7)) * (1 - inOut(ramp(t, 6.75, B.shing[0])));
    z += 0.035 * punch(t, B.shing[0]);
    const spinIn = inOut(ramp(t, B.spin[0] - 0.2, B.spin[0] + 0.3));
    const spinOut = inOut(ramp(t, B.spin[1] - 0.1, B.spin[1] + 0.5));
    z = lerp(z, 1.07, spinIn * (1 - spinOut)) + spinOut * lerp(0.07, 0.12, inOut(ramp(t, B.spin[1], CLIP_END)));
    const env = spinIn * (1 - spinOut);
    roll = env * (0.032 * Math.sin((t - B.spin[0]) * 4.6) + 0.01 * wob(t, 5, 1.1));
    // horizontal: lightly follow his head, shift left for the blade, locked during the spin (the energy pulls the track)
    const follow = 600 + 0.35 * (h.hx - 600);
    const blade = inOut(ramp(t, 6.75, B.shing[0])) * (1 - inOut(ramp(t, B.shing[1], B.spin[0] + 0.2)));
    cx = lerp(lerp(follow, 600, env), 560, blade);
    cy = h.hy + (0.5 - 0.33) * SIZE / z;
    const s1 = shake(t, B.shing[0], 23);
    sh = [s1[0] * 6, s1[1] * 6];
  } else {
    // outro: frozen final pose, the subject on the right, slow push in on the upper body
    const f = T.f[OUTRO_FRAME];
    const hx = f.head[0] * SRC_W, hy = f.head[1] * SRC_H;
    const k = t - CLIP_END;
    z = lerp(1.0, 1.1, outCubic(k / 3.0)) + 0.04 * punch(t, CLIP_END);
    const sx = 0.7, sy = 0.3;
    cx = hx + (0.5 - sx) * SIZE / z;
    cy = hy + (0.5 - sy) * SIZE / z;
    const s1 = shake(t, CLIP_END, 31);
    sh = [s1[0] * 8, s1[1] * 8];
  }
  cx += sh[0] / z; cy += sh[1] / z;
  return fit({ cx, cy, z, roll });
}

// keep the (rotated) window inside the source frame
export function fit(c) {
  const k = Math.abs(Math.cos(c.roll)) + Math.abs(Math.sin(c.roll));
  c.z = Math.max(c.z, k * SIZE / SRC_H);
  const h = (SIZE / 2 / c.z) * k;
  c.cx = clamp(c.cx, h, SRC_W - h);
  c.cy = clamp(c.cy, h, SRC_H - h);
  return c;
}

// source px -> output (screen) px for a camera
export function toScreen(c, sx, sy) {
  const dx = (sx - c.cx) * c.z, dy = (sy - c.cy) * c.z;
  const cs = Math.cos(c.roll), sn = Math.sin(c.roll); // matches camera.rotation.z = roll (world y up)
  return [SIZE / 2 + dx * cs - dy * sn, SIZE / 2 + dx * sn + dy * cs];
}

export function trackAt(t) {
  return T.f[srcIndex(t)];
}
