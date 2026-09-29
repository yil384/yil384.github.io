// Hero scene: a floating voxel island (with a stepped nod to Geisel Library), the scholar
// and Bit standing on it, drifting books and crystals, and a TSL starfield. The camera is
// driven by scroll so the island recedes as the reader moves into the page.
import * as THREE from 'three/webgpu';
import {
  pass, mrt, output, emissive, color, uniform, instancedBufferAttribute, time, hash, instanceIndex,
  sin, float, vec3, mix, mod, uv, smoothstep, length,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ART } from './art.js';
import { voxelSprite, voxelize } from './voxel.js';
import { createRobustRenderer, runLoop, probeGPU, reducedMotion } from './boot.js';

const BG = '#0a0d14';

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

function buildIsland(rand) {
  const island = new THREE.Group();
  const R = 10;
  const cells = [];
  const n2 = (x, z) => Math.sin(x * 0.55) * Math.cos(z * 0.47) + 0.5 * Math.sin((x + z) * 0.9);
  for (let x = -R; x <= R; x++) {
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z) + 0.9 * n2(x * 1.7, z * 1.3);
      if (d > R) continue;
      const top = Math.round(1.2 * n2(x, z) + (d < 4 ? 1 : 0));
      const bottom = -Math.round((R - d) * 1.1 + 1.5 + Math.abs(n2(z, x)) * 2);
      for (let y = bottom; y <= top; y++) {
        cells.push([x, y, z, y === top ? 'grass' : y > top - 2 ? 'dirt' : 'stone']);
      }
    }
  }
  const pal = { grass: ['#4fb56b', '#3f9d5a', '#2f8449'], dirt: ['#8a5a2b', '#6f4622'], stone: ['#3f4a5c', '#33404f', '#262f3d'] };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(box, new THREE.MeshStandardNodeMaterial({ roughness: 0.92 }), cells.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  cells.forEach(([x, y, z, t], i) => {
    m.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, m);
    const p = pal[t];
    mesh.setColorAt(i, c.set(p[Math.abs(x * 7 + z * 13 + y * 3) % p.length]));
  });
  island.add(mesh);

  // Stepped library tower (wider at the top, hollow floors) and a few trees.
  const bld = [];
  const floors = [[0, 1.5], [1, 1.5], [2, 2.5], [3, 3.5], [4, 4.5], [5, 4.5], [6, 3.5], [7, 2.5]];
  for (const [fy, hw] of floors) {
    for (let x = -hw; x <= hw; x++) {
      for (let z = -hw; z <= hw; z++) {
        if (fy > 1 && Math.abs(x) < hw - 0.6 && Math.abs(z) < hw - 0.6 && fy !== 7) continue;
        bld.push([x + 4.5, fy + 2, z - 2.5, fy % 2 ? '#e6e9ef' : '#9aa5b5']);
      }
    }
  }
  for (const [tx, tz] of [[-5, 3], [-3, -5], [6, 5]]) {
    for (let y = 1; y <= 3; y++) bld.push([tx, y + 1, tz, '#6b3f1d']);
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        for (let y = 4; y <= 5; y++) {
          if (y === 5 && Math.abs(x) + Math.abs(z) === 2) continue;
          bld.push([tx + x, y + 1, tz + z, rand() < 0.5 ? '#2f8449' : '#3f9d5a']);
        }
      }
    }
  }
  const bm = new THREE.InstancedMesh(box, new THREE.MeshStandardNodeMaterial({ roughness: 0.85 }), bld.length);
  bld.forEach(([x, y, z, col], i) => {
    m.makeTranslation(x, y, z);
    bm.setMatrixAt(i, m);
    bm.setColorAt(i, c.set(col));
  });
  island.add(bm);

  // Windows on the tower glow softly at night.
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.5, 1.02), new THREE.MeshStandardNodeMaterial({ color: '#0f172a', roughness: 0.4 }));
  win.material.emissiveNode = color('#fde68a').mul(sin(time.mul(0.7)).mul(0.15).add(0.9));
  const wins = new THREE.InstancedMesh(win.geometry, win.material, 24);
  let wi = 0;
  for (const [fy, hw] of floors) {
    if (fy < 2 || fy > 6) continue;
    for (const [x, z] of [[hw, 0], [-hw, 0], [0, hw], [0, -hw]]) {
      if (wi >= 24) break;
      m.makeTranslation(x + 4.5, fy + 2, z - 2.5);
      wins.setMatrixAt(wi++, m);
    }
  }
  wins.count = wi;
  island.add(wins);

  const scholar = voxelSprite(ART.scholar, { glow: { G: 0.6 } });
  scholar.scale.setScalar(0.3);
  scholar.position.set(-1, 1.5, 3);
  scholar.rotation.y = 0.35;
  island.add(scholar);

  const bit = voxelSprite(ART.bit, { glow: { A: 2.2, a: 1.2 } });
  bit.scale.setScalar(0.26);
  bit.position.set(-3.2, 1.2, 4.2);
  bit.rotation.y = 0.6;
  island.add(bit);

  const books = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = voxelize(ART.book, { maxHalf: 1, bevel: 0 });
    b.scale.setScalar(0.18);
    b.userData.a = (i / 3) * Math.PI * 2;
    b.userData.r = 7.5 + i * 1.3;
    books.add(b);
  }
  island.add(books);

  const crystals = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const g = voxelize(ART.crystal, { maxHalf: 1, bevel: 0, glow: { V: 2.5, v: 1.5, W: 4 } });
    g.scale.setScalar(0.28);
    g.userData.a = (i / 3) * Math.PI * 2 + 1;
    crystals.add(g);
  }
  island.add(crystals);

  island.userData = { scholar, bit, books, crystals, voxels: cells.length + bld.length };
  return island;
}

function buildStars(scene, scrollU, rand) {
  const N = 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 60 + rand() * 160;
    const th = rand() * Math.PI * 2;
    pos[i * 3] = Math.cos(th) * r;
    pos[i * 3 + 1] = (rand() - 0.5) * 240;
    pos[i * 3 + 2] = Math.sin(th) * r - 40;
  }
  const P = instancedBufferAttribute(new THREE.InstancedBufferAttribute(pos, 3));
  const seed = hash(instanceIndex);
  const depth = hash(instanceIndex.add(7));
  const y = mod(P.y.add(scrollU.mul(depth.mul(18).add(4))).add(120), 240).sub(120);
  const mat = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  mat.positionNode = vec3(P.x, y, P.z);
  mat.sizeNode = seed.mul(seed).mul(3.6).add(1.4);
  mat.sizeAttenuation = false;
  const tw = sin(time.mul(seed.mul(2.5).add(0.6)).add(seed.mul(40))).mul(0.3).add(0.8);
  const disc = smoothstep(0.5, 0.15, length(uv().sub(0.5)));
  const warm = seed.greaterThan(0.88).select(float(1), float(0));
  mat.colorNode = mix(color('#c7d2fe'), color('#ffe08a'), warm).mul(tw);
  mat.opacityNode = disc.mul(tw);
  const stars = new THREE.Sprite(mat);
  stars.count = N;
  stars.frustumCulled = false;
  scene.add(stars);
}

/**
 * Mounts the hero scene onto `canvas`. Resolves to a controller, or null when the device
 * cannot run it (the caller keeps its CSS poster in that case).
 */
export async function mountHero(canvas, { heroEl, force = false } = {}) {
  const probe = probeGPU();
  const saveData = navigator.connection?.saveData === true;
  if (!force && (!probe.ok || probe.software || saveData)) return null;

  const rand = mulberry(20260929);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.009);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
  scene.add(new THREE.HemisphereLight('#c7d2fe', '#0b1024', 1.15));
  const sun = new THREE.DirectionalLight('#ffe7c2', 2.3);
  sun.position.set(-18, 30, 16);
  scene.add(sun);

  const island = buildIsland(rand);
  scene.add(island);
  const scrollU = uniform(0);
  buildStars(scene, scrollU, rand);

  let progress = 0;
  const readScroll = () => {
    const h = heroEl ? heroEl.offsetHeight : window.innerHeight;
    progress = Math.min(1.5, window.scrollY / Math.max(1, h));
    scrollU.value = window.scrollY / 40;
  };

  const ease = (t) => t * t * (3 - 2 * t);
  function rig(t) {
    const p = ease(Math.min(1, progress));
    const ang = 0.35 + p * 1.1 + (reducedMotion.matches ? 0 : Math.sin(t * 0.15) * 0.06);
    const fitDist = 17 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));
    const dist = Math.max(60, fitDist) + p * 70;
    camera.position.set(Math.sin(ang) * dist, 10 + p * 6, Math.cos(ang) * dist);
    const wide = camera.aspect > 1.1;
    island.position.set(wide ? 13 : 0, -1 + p * 30, 0);
    camera.lookAt(wide ? 3 : 0, wide ? 2 + p * 4 : -14 + p * 4, 0);
    island.visible = progress < 1.45;
  }

  let pipeline;
  function build(r) {
    r.toneMapping = THREE.NeutralToneMapping;
    const p = new THREE.RenderPipeline(r);
    const sp = pass(scene, camera);
    sp.setMRT(mrt({ output, emissive }));
    p.outputNode = sp.getTextureNode('output').add(bloom(sp.getTextureNode('emissive'), 1.0, 0.5, 0));
    return p;
  }
  function resize(r) {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    r.setSize(w, h, false);
  }

  let live = canvas;
  const { renderer } = await createRobustRenderer(
    () => {
      const c = document.createElement('canvas');
      c.className = live.className;
      c.setAttribute('aria-hidden', 'true');
      live.replaceWith(c);
      live = c;
      return c;
    },
    async (r) => {
      resize(r);
      readScroll();
      rig(0);
      await r.compileAsync(scene, camera);
      pipeline = build(r);
      pipeline.render();
    },
    { maxDpr: 1.5, antialias: false, alpha: false },
  );

  let lastW = window.innerWidth;
  const onResize = () => {
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - live.clientHeight) < 120) return;
    lastW = window.innerWidth;
    resize(renderer);
    if (!running()) frame(0, performance.now() / 1000);
  };
  window.addEventListener('resize', onResize);

  const U = island.userData;
  function frame(dt, t) {
    if (!reducedMotion.matches) {
      island.rotation.y += dt * 0.07;
      U.scholar.position.y = 1.5 + Math.abs(Math.sin(t * 2.4)) * 0.22;
      U.scholar.userData.setFrame(Math.floor(t * 2) % 2);
      U.bit.position.y = 1.2 + Math.sin(t * 3.1) * 0.35;
      U.bit.userData.setFrame(Math.floor(t * 3) % 2);
      U.books.children.forEach((b) => {
        b.userData.a += dt * 0.35;
        b.position.set(Math.cos(b.userData.a) * b.userData.r, 4 + Math.sin(b.userData.a * 3) * 0.6, Math.sin(b.userData.a) * b.userData.r);
        b.rotation.y = b.userData.a + Math.PI / 2;
        b.rotation.z = Math.sin(b.userData.a * 2) * 0.2;
      });
      U.crystals.children.forEach((g) => {
        g.userData.a += dt * 0.5;
        g.position.set(Math.cos(g.userData.a) * 12, 7 + Math.sin(g.userData.a * 2) * 1.2, Math.sin(g.userData.a) * 12);
        g.rotation.y += dt * 1.4;
      });
    }
    rig(t);
    pipeline.render();
  }
  const loop = runLoop(renderer, frame, { target: heroEl || null });
  const running = () => !reducedMotion.matches && !document.hidden;
  const onScroll = () => {
    readScroll();
    if (!running()) frame(0, performance.now() / 1000);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  return {
    canvas: () => live,
    stats: () => loop.stats(),
    pause: () => loop.setEnabled(false),
    resume: () => loop.setEnabled(true),
    dispose() {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
  };
}
