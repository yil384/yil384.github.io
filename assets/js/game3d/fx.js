// Effects in world space: particle bursts (pooled instanced cubes), ground rings, beams,
// and floating combat text (DOM labels projected through the camera).
import * as THREE from 'three/webgpu';
import { makeRing } from './actors.js';

let scene, camera, labelRoot, overlay;
const particles = { mesh: null, alive: [], max: 320, free: [] };
const rings = [];
const beams = [];
const labels = [];
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

export function initFx({ scene: s, camera: c, root }) {
  scene = s; camera = c; overlay = root;
  labelRoot = document.createElement('div');
  labelRoot.className = 'g__fx';
  root.append(labelRoot);
  const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const mat = new THREE.MeshBasicNodeMaterial();
  particles.mesh = new THREE.InstancedMesh(geo, mat, particles.max);
  particles.mesh.frustumCulled = false;
  particles.mesh.count = 0;
  for (let i = 0; i < particles.max; i++) particles.free.push(i);
  particles.data = new Array(particles.max).fill(null);
  scene.add(particles.mesh);
}

export function burst(x, y, z, color = '#f2b84b', count = 10, speed = 5, life = 0.6, size = 1) {
  for (let i = 0; i < count; i++) {
    const idx = particles.free.pop();
    if (idx == null) return;
    const a = Math.random() * Math.PI * 2;
    const el = Math.random() * Math.PI - Math.PI / 2;
    const sp = speed * (0.4 + Math.random() * 0.8);
    particles.data[idx] = {
      x, y, z, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp + speed * 0.4, vz: Math.sin(a) * Math.cos(el) * sp,
      life, t: 0, size: size * (0.6 + Math.random() * 0.8),
    };
    particles.alive.push(idx);
    particles.mesh.setColorAt(idx, _c.set(color));
  }
  particles.mesh.instanceColor.needsUpdate = true;
}

export function ring(x, y, z, color = '#f2b84b', radius = 1.5, life = 0.5) {
  const m = makeRing(color, radius);
  m.position.set(x, y + 0.06, z);
  scene.add(m);
  rings.push({ m, t: 0, life, radius });
}

export function beam(ax, ay, az, bx, by, bz, color = '#fde047', width = 0.12, life = 0.28) {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const geo = new THREE.CylinderGeometry(width, width, len, 6, 1, true);
  const mat = new THREE.MeshBasicNodeMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(bx - ax, by - ay, bz - az).normalize());
  scene.add(m);
  beams.push({ m, t: 0, life });
}

/** Floating text above a world point. kind: dmg | crit | heal | mp | block | gold | xp | info | super | hurt */
export function text(x, y, z, str, kind = 'dmg') {
  const el = document.createElement('div');
  el.className = `g__label g__label--${kind}`;
  el.textContent = str;
  labelRoot.append(el);
  labels.push({ el, x: x + (Math.random() - 0.5) * 0.6, y, z, t: 0, life: kind === 'crit' ? 1.2 : 1.0 });
}

/** Project a world point to overlay pixels. Returns null when it is behind the camera. */
export function project(x, y, z) {
  _v.set(x, y, z).project(camera);
  if (_v.z > 1) return null;
  return { sx: (_v.x + 1) / 2 * overlay.clientWidth, sy: (1 - _v.y) / 2 * overlay.clientHeight };
}

// Persistent DOM labels attached to a world point (NPC nameplates, drop tags, door prompt).
const pins = [];
export function pin(el, getPos) {
  labelRoot.append(el);
  const p = { el, getPos };
  pins.push(p);
  return () => { el.remove(); const i = pins.indexOf(p); if (i >= 0) pins.splice(i, 1); };
}

export function updateFx(dt) {
  for (const p of pins) {
    const w = p.getPos();
    const s = w && project(w.x, w.y, w.z);
    if (!s) { p.el.style.display = 'none'; continue; }
    p.el.style.display = '';
    p.el.style.transform = `translate(-50%, -100%) translate(${s.sx.toFixed(0)}px, ${s.sy.toFixed(0)}px)`;
  }
  // particles
  const P = particles;
  for (let i = P.alive.length - 1; i >= 0; i--) {
    const idx = P.alive[i];
    const d = P.data[idx];
    d.t += dt;
    if (d.t >= d.life) {
      P.alive.splice(i, 1);
      P.free.push(idx);
      _m.makeScale(0, 0, 0);
      P.mesh.setMatrixAt(idx, _m);
      continue;
    }
    d.vy -= 14 * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    const s = d.size * (1 - d.t / d.life);
    _m.makeScale(s, s, s).setPosition(d.x, d.y, d.z);
    P.mesh.setMatrixAt(idx, _m);
  }
  P.mesh.count = P.max;
  P.mesh.instanceMatrix.needsUpdate = true;
  // rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const k = r.t / r.life;
    if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); continue; }
    r.m.scale.setScalar(0.3 + k * 1.1);
    r.m.material.opacity = 0.9 * (1 - k);
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i];
    b.t += dt;
    const k = b.t / b.life;
    if (k >= 1) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); beams.splice(i, 1); continue; }
    b.m.material.opacity = 0.95 * (1 - k);
  }
  // labels: project to screen
  const w = overlay.clientWidth, h = overlay.clientHeight;
  for (let i = labels.length - 1; i >= 0; i--) {
    const l = labels[i];
    l.t += dt;
    if (l.t >= l.life) { l.el.remove(); labels.splice(i, 1); continue; }
    _v.set(l.x, l.y + l.t * 1.6, l.z).project(camera);
    const sx = (_v.x + 1) / 2 * w, sy = (1 - _v.y) / 2 * h;
    l.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px)`;
    l.el.style.opacity = l.t < l.life * 0.7 ? 1 : 1 - (l.t - l.life * 0.7) / (l.life * 0.3);
  }
}

export function clearFx() {
  for (const r of rings) scene.remove(r.m);
  rings.length = 0;
  for (const b of beams) scene.remove(b.m);
  beams.length = 0;
  for (const l of labels) l.el.remove();
  labels.length = 0;
}

let shakeUntil = 0, shakePower = 0;
export function shake(power = 0.4, ms = 250) {
  shakeUntil = performance.now() + ms;
  shakePower = power;
}
/** Applied by the camera after it has placed itself for the frame. */
export function shakeOffset() {
  const left = shakeUntil - performance.now();
  if (left <= 0) return 0;
  return shakePower * Math.min(1, left / 250);
}
