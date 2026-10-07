// The intro's last beat in three.js: the cracked frame becomes real glass. Every shard of the fracture is a
// slab (front, back and edge faces) textured with the snapshot of the 2D stage at its own screen position, so
// at rest the 3D frame is pixel-for-pixel the 2D one. Then the slabs burst out of the hit: tumbling, falling,
// flying past the camera, catching the light on their faces and edges, with glass dust in between, and the
// page underneath shows through. All motion runs in the vertex shader (one draw call for the shards, one for
// the dust); the CPU only advances a time uniform. Units: CSS pixels, y up, the z = 0 plane fills the screen.
import * as THREE from 'three/webgpu';
import {
  attribute, uniform, varying, texture, uv, vec3, float, cos, sin, cross, dot, normalize, max, min, pow, abs, mix,
  reflect, smoothstep, length, positionLocal, normalLocal, select,
} from 'three/tsl';
import { GRAVITY } from './fracture.js';

const FOV = 35;

/**
 * @param canvas a fresh canvas for the WebGL context
 * @param opt { w, h: CSS px, dpr, fr: the fracture with motion (fracture.js), snap: the canvas to texture from }
 * @returns { render(t): bool (false once everything is gone), upload(), dispose() }
 */
export async function createShatter3D(canvas, { w, h, dpr, fr, snap, rand }) {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x000000, 0);
  await renderer.init();

  const dist = (h / 2) / Math.tan((FOV / 2) * Math.PI / 180);
  const camera = new THREE.PerspectiveCamera(FOV, w / h, 8, dist * 4);
  camera.position.set(0, 0, dist);
  const scene = new THREE.Scene();

  const tex = new THREE.CanvasTexture(snap);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const T = uniform(0);

  // ---- the shards: one geometry, per-vertex motion data
  const pos = [], nrm = [], uvs = [], cen = [], axis = [], vel = [], misc = [];
  const th = Math.max(5, Math.min(10, h / 110));
  for (const s of fr.shards) {
    // to world space (y up); keep the polygon counter-clockwise there
    let pts = s.pts.map(([x, y]) => [x - w / 2, h / 2 - y, x / w, 1 - y / h]);
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (a < 0) pts = pts.reverse();
    const cx = s.cx - w / 2, cy = h / 2 - s.cy, cz = -th / 2;
    const cu = s.cx / w, cv = 1 - s.cy / h;
    const push = (x, y, z, u, v, nx, ny, nz, face) => {
      pos.push(x - cx, y - cy, z - cz); nrm.push(nx, ny, nz); uvs.push(u, v);
      cen.push(cx, cy, cz);
      axis.push(s.ax, -s.ay, s.az, s.spin);
      vel.push(s.vx, -s.vy, s.vz, s.delay);
      misc.push(s.life, face);
    };
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      push(cx, cy, 0, cu, cv, 0, 0, 1, 0); push(p[0], p[1], 0, p[2], p[3], 0, 0, 1, 0); push(q[0], q[1], 0, q[2], q[3], 0, 0, 1, 0);
      push(cx, cy, -th, cu, cv, 0, 0, -1, 1); push(q[0], q[1], -th, q[2], q[3], 0, 0, -1, 1); push(p[0], p[1], -th, p[2], p[3], 0, 0, -1, 1);
      const ex = q[0] - p[0], ey = q[1] - p[1], el = Math.hypot(ex, ey) || 1, nx = ey / el, ny = -ex / el;
      push(p[0], p[1], 0, p[2], p[3], nx, ny, 0, 2); push(p[0], p[1], -th, p[2], p[3], nx, ny, 0, 2); push(q[0], q[1], -th, q[2], q[3], nx, ny, 0, 2);
      push(p[0], p[1], 0, p[2], p[3], nx, ny, 0, 2); push(q[0], q[1], -th, q[2], q[3], nx, ny, 0, 2); push(q[0], q[1], 0, q[2], q[3], nx, ny, 0, 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(cen, 3));
  geo.setAttribute('aAxis', new THREE.Float32BufferAttribute(axis, 4));
  geo.setAttribute('aVel', new THREE.Float32BufferAttribute(vel, 4));
  geo.setAttribute('aMisc', new THREE.Float32BufferAttribute(misc, 2));

  const aCenter = attribute('aCenter', 'vec3'), aAxis = attribute('aAxis', 'vec4'), aVel = attribute('aVel', 'vec4'), aMisc = attribute('aMisc', 'vec2');
  const tt = max(T.sub(aVel.w), 0);
  const ang = aAxis.w.mul(tt).mul(min(tt.mul(6), 1));
  const k = aAxis.xyz;
  const rotate = (v) => v.mul(cos(ang)).add(cross(k, v).mul(sin(ang))).add(k.mul(dot(k, v).mul(float(1).sub(cos(ang)))));
  const fall = vec3(aVel.x.mul(tt), aVel.y.mul(tt).sub(tt.mul(tt).mul(GRAVITY / 2)), aVel.z.mul(tt));
  const world = aCenter.add(rotate(positionLocal)).add(fall);
  const vN = varying(rotate(normalLocal), 'vShardN');
  const vT = varying(tt, 'vShardT');
  const vFace = varying(aMisc.y, 'vShardFace');
  const vLife = varying(aMisc.x, 'vShardLife');

  // a fixed view vector: no glare on the intact pane (so frame 0 is the 2D frame), glints only once a shard turns
  const N = normalize(vN), V = vec3(0, 0, 1);
  const Ld = normalize(vec3(-0.45, 0.6, 1));
  const rest = float(1 / Math.hypot(0.45, 0.6, 1));
  const img = texture(tex, uv()).rgb;
  const diff = dot(N, Ld).sub(rest);
  const spec = pow(max(dot(reflect(Ld.negate(), N), V), 0), 40).min(0.8);
  const fres = pow(float(1).sub(abs(dot(N, V))), 3);
  const glass = vec3(0.62, 0.9, 1);
  const front = img.mul(diff.mul(0.9).add(1)).add(spec.mul(0.9)).add(glass.mul(fres).mul(0.28));
  const backC = img.mul(0.45).add(vec3(0.02, 0.05, 0.09)).add(spec.mul(0.5));
  const edge = glass.mul(spec.mul(0.6).add(fres.mul(0.4)).add(0.32));
  const shardMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: true, side: THREE.FrontSide });
  shardMat.positionNode = world;
  shardMat.colorNode = select(vFace.lessThan(0.5), front, select(vFace.lessThan(1.5), backC, edge));
  shardMat.opacityNode = float(1).sub(smoothstep(vLife.sub(0.32), vLife, vT));
  const shards = new THREE.Mesh(geo, shardMat);
  shards.frustumCulled = false;
  scene.add(shards);

  // ---- glass dust and glints, born on the cracks
  const nDust = Math.round(Math.min(560, Math.max(220, (w * h) / 3600)));
  const segs = fr.segs, total = segs.reduce((acc, s) => acc + Math.hypot(s.bx - s.ax, s.by - s.ay), 0) || 1;
  const dPos = [], dStart = [], dVel = [], dCorner = [], idx = [];
  for (let i = 0; i <= nDust; i++) {
    let x, y, size, life, delay, vx, vy, vz;
    if (i === nDust) {
      // a glint where it hit
      x = fr.ix; y = fr.iy; size = Math.max(w, h) * 0.16; life = 0.2; delay = 0; vx = vy = vz = 0;
    } else {
      let r = rand() * total, s = segs[0];
      for (const sg of segs) { r -= Math.hypot(sg.bx - sg.ax, sg.by - sg.ay); if (r <= 0) { s = sg; break; } }
      const f = rand();
      x = s.ax + (s.bx - s.ax) * f; y = s.ay + (s.by - s.ay) * f;
      const dx = x - fr.ix, dy = y - fr.iy, d = Math.hypot(dx, dy) || 1, dn = Math.min(1, d / fr.maxR);
      const sp = (1 - dn) * 700 + 160 + rand() * 300;
      vx = (dx / d) * sp + (rand() - 0.5) * 260; vy = (dy / d) * sp + (rand() - 0.5) * 260 - 200;
      vz = rand() * 900 * (1 - dn);
      size = 2 + rand() ** 3 * 9;
      life = 0.5 + rand() * 0.7;
      delay = dn * 0.16 + rand() * 0.05;
    }
    const X = x - w / 2, Y = h / 2 - y;
    const base = dPos.length / 3;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      dPos.push(0, 0, 0);
      dStart.push(X, Y, 2, life);
      dVel.push(vx, -vy, vz, delay);
      dCorner.push(cx, cy, size, i === nDust ? -1 : rand());
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.Float32BufferAttribute(dPos, 3));
  dGeo.setAttribute('aStart', new THREE.Float32BufferAttribute(dStart, 4));
  dGeo.setAttribute('aVel', new THREE.Float32BufferAttribute(dVel, 4));
  dGeo.setAttribute('aCorner', new THREE.Float32BufferAttribute(dCorner, 4));
  dGeo.setIndex(idx);
  const dS = attribute('aStart', 'vec4'), dV = attribute('aVel', 'vec4'), dC = attribute('aCorner', 'vec4');
  const dt = max(T.sub(dV.w), 0);
  const twinkle = select(dC.w.lessThan(0), float(1).add(dt.mul(3)), sin(T.mul(34).add(dC.w.mul(40))).mul(0.45).add(0.75));
  const dWorld = dS.xyz.add(vec3(dV.x.mul(dt), dV.y.mul(dt).sub(dt.mul(dt).mul(GRAVITY * 0.35)), dV.z.mul(dt)))
    .add(vec3(dC.x, dC.y, 0).mul(dC.z).mul(twinkle));
  const vC = varying(dC.xy, 'vDustC');
  const vDT = varying(dt.div(dS.w), 'vDustT');
  const vFlash = varying(select(dC.w.lessThan(0), float(1), float(0)), 'vDustFlash');
  const r = length(vC);
  const dot0 = pow(max(float(1).sub(r), 0), 2);
  const star = max(float(1).sub(abs(vC.x).mul(9)), 0).mul(max(float(1).sub(abs(vC.y)), 0)).add(max(float(1).sub(abs(vC.y).mul(9)), 0).mul(max(float(1).sub(abs(vC.x)), 0)));
  const dustMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  dustMat.positionNode = dWorld;
  dustMat.colorNode = mix(vec3(0.75, 0.95, 1), vec3(0.85, 1, 0.92), vFlash);
  dustMat.opacityNode = mix(dot0.add(star.mul(0.8)), dot0.mul(0.7), vFlash).mul(float(1).sub(smoothstep(0.55, 1, vDT))).mul(select(vDT.greaterThan(0), 1, 0)).mul(mix(float(1), float(1).sub(vDT), vFlash));
  const dust = new THREE.Mesh(dGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 1;
  scene.add(dust);

  await renderer.compileAsync(scene, camera);

  const end = Math.max(...fr.shards.map((s) => s.delay + s.life), 1.2) + 0.05;
  return {
    upload() { tex.needsUpdate = true; },
    render(t) {
      T.value = t;
      renderer.render(scene, camera);
      return t < end;
    },
    dispose() {
      geo.dispose(); dGeo.dispose(); shardMat.dispose(); dustMat.dispose(); tex.dispose();
      renderer.dispose();
    },
  };
}
