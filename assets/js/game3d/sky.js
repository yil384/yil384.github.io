// The sky around the island: gradient dome, a TSL starfield that drifts with page scroll, the
// moon, a sea of voxel clouds and shooting stars. Everything here is decoration except the moon,
// which the stage registers as a clickable easter egg.
import * as THREE from 'three/webgpu';
import {
  color, uniform, instancedBufferAttribute, time, hash, instanceIndex, positionLocal,
  sin, float, vec3, mix, mod, uv, smoothstep, length,
} from 'three/tsl';
import { reducedMotion } from '../three/boot.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSky(scene, { lowfx = false } = {}) {
  const rand = mulberry(20260930);
  const group = new THREE.Group();
  scene.add(group);
  const scrollU = uniform(0);

  // ---- gradient dome ----
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 20),
    new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  const n = positionLocal.normalize();
  const up = smoothstep(-0.15, 0.85, n.y);
  const glow = smoothstep(0.35, -0.02, n.y.abs());             // horizon band
  dome.material.colorNode = mix(mix(color('#04060d'), color('#0b1030'), up), color('#2a2f73'), glow.mul(0.55));
  dome.renderOrder = -10;
  group.add(dome);

  // ---- stars ----
  const N = lowfx ? 700 : 1500;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 200 + rand() * 120;
    const th = rand() * Math.PI * 2;
    const y = (rand() * 1.5 - 0.35);                            // mostly above the horizon
    const rr = Math.sqrt(Math.max(0, 1 - Math.min(1, y * y)));
    pos[i * 3] = Math.cos(th) * rr * r;
    pos[i * 3 + 1] = y * r;
    pos[i * 3 + 2] = Math.sin(th) * rr * r;
  }
  const P = instancedBufferAttribute(new THREE.InstancedBufferAttribute(pos, 3));
  const seed = hash(instanceIndex);
  const depth = hash(instanceIndex.add(7));
  const drift = scrollU.mul(depth.mul(0.9).add(0.15));
  const py = mod(P.y.add(drift).add(320), 640).sub(320);
  const mat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  mat.positionNode = vec3(P.x, py, P.z);
  mat.sizeNode = seed.mul(seed).mul(3.4).add(1.3);
  mat.sizeAttenuation = false;
  const tw = sin(time.mul(seed.mul(2.5).add(0.6)).add(seed.mul(40))).mul(0.3).add(0.8);
  const disc = smoothstep(0.5, 0.15, length(uv().sub(0.5)));
  const warm = seed.greaterThan(0.88).select(float(1), float(0));
  mat.colorNode = mix(color('#c7d2fe'), color('#ffe08a'), warm).mul(tw);
  mat.opacityNode = disc.mul(tw);
  const stars = new THREE.Sprite(mat);
  stars.count = N;
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  // ---- moon ----
  const moon = new THREE.Group();
  moon.position.set(120, -42, -222);
  const disc0 = new THREE.Mesh(new THREE.CircleGeometry(15, 40), new THREE.MeshBasicNodeMaterial({ color: '#f4efd8', fog: false }));
  // the craters: one geometry (was one mesh each)
  {
    const pos = [], ind = [];
    for (const [cx, cy, r] of [[-4, 3, 2.6], [4.5, -2, 3.4], [-1, -6, 1.8], [6, 6, 1.5], [-7, -3, 1.4]]) {
      const g = new THREE.CircleGeometry(r, 20);
      const base = pos.length / 3, p = g.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) pos.push(p[i] + cx, p[i + 1] + cy, 0.05);
      for (const k of g.index.array) ind.push(base + k);
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(ind);
    moon.add(new THREE.Mesh(geo, new THREE.MeshBasicNodeMaterial({ color: '#d8d2b6', fog: false })));
  }
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  halo.material.colorNode = color('#8fa0ff').mul(smoothstep(0.5, 0.05, length(uv().sub(0.5))).pow(2).mul(0.5));
  halo.material.opacityNode = float(1);
  halo.position.z = -0.1;
  moon.add(halo, disc0);
  moon.lookAt(0, 0, 0);
  group.add(moon);
  disc0.userData.moon = true;

  // ---- clouds: small flattened voxel puffs far out, mostly below the island, on a slow drift ----
  const cloudMat = new THREE.MeshStandardNodeMaterial({ color: '#b9c3f0', roughness: 1, emissive: '#3b4285', emissiveIntensity: 0.5 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  // every puff of every cloud in ONE instanced mesh (was one draw call per cloud); the ring of clouds
  // turns slowly as a whole instead of each cloud sliding on its own
  const CLOUDS = lowfx ? 12 : 22;
  const puffList = [];
  const cm = new THREE.Matrix4(), pm = new THREE.Matrix4();
  for (let i = 0; i < CLOUDS; i++) {
    const cell = 1.8 + rand() * 1.6;
    const puffs = 5 + Math.floor(rand() * 6);
    const a = rand() * Math.PI * 2;
    const r = 105 + rand() * 90;                       // well outside the camera's orbit
    const high = rand() < 0.25;
    cm.compose(new THREE.Vector3(Math.cos(a) * r, high ? 24 + rand() * 40 : -34 + rand() * 22, Math.sin(a) * r),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI), new THREE.Vector3(1, 1, 1));
    for (let k = 0; k < puffs; k++) {
      const sx = cell * (1.5 + rand() * 1.5), sz = cell * (1.3 + rand() * 1.2), sy = cell * (0.5 + rand() * 0.35);
      pm.compose(new THREE.Vector3((k - puffs / 2) * cell * 1.25 + (rand() - 0.5) * cell, (rand() - 0.5) * cell * 0.4, (rand() - 0.5) * cell * 1.5),
        new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
      puffList.push(pm.clone().premultiply(cm));
    }
  }
  const clouds = new THREE.InstancedMesh(box, cloudMat, puffList.length);
  puffList.forEach((m, i) => clouds.setMatrixAt(i, m));
  clouds.instanceMatrix.needsUpdate = true;
  clouds.frustumCulled = false;
  group.add(clouds);

  // ---- shooting stars ----
  const streaks = [];
  const streakGeo = new THREE.BoxGeometry(0.5, 0.5, 26);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(streakGeo, new THREE.MeshBasicNodeMaterial({ color: '#e0e7ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.visible = false;
    s.userData = { t: 1, life: 1, from: new THREE.Vector3(), to: new THREE.Vector3() };
    group.add(s);
    streaks.push(s);
  }
  let nextStreak = 6 + rand() * 8;
  let shower = 0;
  function launch() {
    const s = streaks.find((x) => x.userData.t >= 1);
    if (!s) return;
    const u = s.userData;
    const a = rand() * Math.PI * 2;
    u.from.set(Math.cos(a) * 190, 70 + rand() * 90, Math.sin(a) * 190);
    u.to.set(u.from.x + (rand() - 0.5) * 160, u.from.y - 45 - rand() * 40, u.from.z + (rand() - 0.5) * 160);
    u.t = 0; u.life = 0.9 + rand() * 0.5;
    s.visible = true;
    s.lookAt(u.to);
  }

  const api = {
    group, moon, moonHit: disc0, scrollU,
    /** Park the moon low on the horizon, `az` radians to the right of a camera heading (yaw). */
    placeMoon(yaw, az = 0.25, R = 250, elev = -0.16) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const c = Math.cos(az), sn = Math.sin(az);
      moon.position.set((fx * c + rx * sn) * R, Math.tan(elev) * R, (fz * c + rz * sn) * R);
      moon.lookAt(0, 0, 0);
    },
    /** Scroll offset in page pixels; the stars slide past as the reader travels. */
    setScroll(px) { scrollU.value = px / 40; },
    /** A burst of shooting stars (the moon egg). */
    shower(seconds = 6) { shower = seconds; },
    update(dt) {
      if (!reducedMotion.matches) clouds.rotation.y += dt * 0.004;
      nextStreak -= dt;
      if (shower > 0) { shower -= dt; if (Math.random() < dt * 9) launch(); }
      else if (nextStreak <= 0) { nextStreak = 9 + rand() * 14; launch(); }
      for (const s of streaks) {
        const u = s.userData;
        if (u.t >= 1) continue;
        u.t += dt / u.life;
        if (u.t >= 1) { s.visible = false; continue; }
        s.position.lerpVectors(u.from, u.to, u.t);
        s.material.opacity = Math.sin(Math.PI * u.t) * 0.9;
      }
    },
  };
  return api;
}
