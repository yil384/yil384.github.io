// director/director.js — the live layer behind the page: ONE fixed canvas, ONE renderer (WebGPU, WebGL2 fallback), ONE post pipeline.
// Scroll drives a rail parameter s in [0, N): section i is [i, i+1). The camera flies keyframed poses; the hangar set serves the
// first five stations, a cream flash swaps to the island at s = 4.62. Everything is built up front and toggled with `visible`.
//
//   mount(canvas, { tier, force, backend }) -> { pause, resume, dispose, stats, setSection, onlost, backend, tier, section }
//
// Tiers (ARCH §2): tier >= 2 on the WebGPU backend runs the full post stack; otherwise the cheap stack at pixelRatio <= 1.5.
import * as THREE from 'three/webgpu';
import { mix, vec4, uniform, color } from 'three/tsl';
import { createRobustRenderer, runLoop, reducedMotion } from '../three/boot.js';
import { createAnimePipeline } from '../engine/post.js';
import { paintedSky } from '../engine/sky.js';
import { loadProps, makeMaterials } from '../props/loader.js';
import * as hangar from '../scenes/hangar.js';
import * as island from '../scenes/island.js';

const SWAP_S = 4.62;
// [enter, exit] camera pose per section. World: K-01 at the origin facing +z, hangar door at z = 70, island plaza at (2.4, 1, 3.2).
const POSES = [
  [{ pos: [0, 16.5, 9], look: [0, 16.4, 0], fov: 30 }, { pos: [-4, 10, 26], look: [0, 10, 0], fov: 38 }],        // S0 cold open: the visor glint pulls back
  [{ pos: [-9, 2.5, 17], look: [0, 7, 0], fov: 46 }, { pos: [-22, 14, 32], look: [0, 9, 0], fov: 40 }],           // S1 hangar deck: low three-quarter rising to a wide shot
  [{ pos: [-9, 4.5, -30], look: [0, 8, 40], fov: 42 }, { pos: [-9, 7, 34], look: [0, 10, 70], fov: 46 }],        // S2 catapult: down the deck toward the opening door
  [{ pos: [8, 1.8, 11], look: [3, 1.4, 2], fov: 44 }, { pos: [-6, 2.2, 9], look: [0, 4, 0], fov: 44 }],          // S3 crew deck at floor level
  [{ pos: [-9, 13, -15], look: [0, 13, -3], fov: 38 }, { pos: [9, 12, -14], look: [0, 13, -3], fov: 38 }],       // S4 equipment: the thruster pack
  [{ pos: [-34, 14, 30], look: [0, 5, 0], fov: 40 }, { pos: [-16, 3, 15], look: [2, 7, 3], fov: 40 }],           // S5 home base: island from the sky, descending
  [{ pos: [-13, 2.5, 12], look: [2, 8, 2], fov: 40 }, { pos: [-9, 3, 10], look: [2, 9, 2], fov: 40 }],           // S6 comms: plaza level at dusk
];
const KEYS = POSES.flatMap(([a, b], i) => [{ u: i + 0.08, p: a }, { u: i + 0.9, p: b }]);
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

function poseAt(s, out) {
  let i = 0;
  while (i < KEYS.length - 2 && s > KEYS[i + 1].u) i++;
  const A = KEYS[i], B = KEYS[i + 1], k = smooth((s - A.u) / (B.u - A.u));
  for (let c = 0; c < 3; c++) { out.pos[c] = lerp(A.p.pos[c], B.p.pos[c], k); out.look[c] = lerp(A.p.look[c], B.p.look[c], k); }
  out.fov = lerp(A.p.fov, B.p.fov, k);
  return out;
}

export async function mount(canvas, { tier = 1, force = false } = {}) {
  const t0 = performance.now();
  const props = await loadProps();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 900);
  const uSky = uniform(0);
  const skyNode = paintedSky({ zenith: '#1E2A5E', horizon: '#E9557D', sun: '#FFD470', sunDir: new THREE.Vector3(0.55, 0.35, 0.75) });
  scene.backgroundNode = mix(vec4(color('#0A0B14'), 1), skyNode, uSky);

  let live = canvas, first = true;
  const makeCanvas = () => { if (first) { first = false; return live; } const c = canvas.cloneNode(false); live.replaceWith(c); live = c; return c; };
  let post = null, H = null, I = null, mats = null;
  const size = (r) => {
    const w = Math.max(2, window.innerWidth), h = Math.max(2, window.innerHeight);
    if (post) post.setSize(w, h, false); else { r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  };
  const { renderer, backend, recovered } = await createRobustRenderer(makeCanvas, async (r) => {
    r.toneMapping = THREE.NeutralToneMapping;
    r.info.autoReset = true;
    mats = makeMaterials();
    H = hangar.build({ props, mats, tier });
    I = island.build({ props, mats, tier });
    I.group.visible = false;
    scene.add(H.group, I.group);
    size(r);
    await r.compileAsync(scene, camera);
    I.group.visible = true; await r.compileAsync(scene, camera); I.group.visible = false;
    post = createAnimePipeline(r, scene, camera, { quality: 'cheap', scanlines: true, outline: { color: '#0a0b14', thickness: 0.0035 }, bloom: { strength: 0.55, radius: 0.5, threshold: 0 } });
    size(r);
    post.render();
  }, { maxDpr: tier >= 2 ? 1.75 : 1.5, antialias: false, alpha: false });
  post.setQuality(backend === 'webgpu' && tier >= 2 ? 'full' : 'cheap');
  post.uniforms.aberration.value = 0.003;
  post.uniforms.vignette.value = 0.35;
  live.hidden = false;

  // ---- rail: scroll -> s ----
  let lock = null, knots = [], sTarget = 0, sNow = 0, pointer = { x: 0, y: 0 }, ptr = { x: 0, y: 0 };
  const measure = () => {
    const secs = [...document.querySelectorAll('section[data-scene]')];
    knots = secs.map((el, i) => ({ i: Number(el.dataset.s ?? i), top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
    knots.sort((a, b) => a.i - b.i);
  };
  const sFromScroll = () => {
    if (!knots.length) return 0;
    const y = scrollY + innerHeight * 0.35;
    let j = 0; while (j < knots.length - 1 && y >= knots[j + 1].top) j++;
    const K = knots[j], end = j < knots.length - 1 ? knots[j + 1].top : K.top + K.h;
    return K.i + Math.min(1, Math.max(0, (y - K.top) / Math.max(1, end - K.top)));
  };
  measure();
  const ro = new ResizeObserver(() => { measure(); size(renderer); });
  ro.observe(document.body);
  const onResize = () => { measure(); size(renderer); };
  addEventListener('resize', onResize);
  const onPointer = (e) => { pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = (e.clientY / innerHeight - 0.5) * 2; };
  if (matchMedia('(pointer: fine)').matches) addEventListener('pointermove', onPointer, { passive: true });
  sNow = sTarget = sFromScroll();

  // ---- frame ----
  const pose = { pos: [0, 0, 0], look: [0, 0, 0], fov: 40 };
  const slow = { n: 0, worst: 0 };
  let section = 0, lost = null;
  const api = { backend, tier, recovered, onlost: null, get section() { return section; }, setSection() {} };
  const tick = (dt, t) => {
    sTarget = lock ?? sFromScroll();
    sNow += (sTarget - sNow) * (reducedMotion.matches ? 1 : 1 - Math.exp(-8 * dt));
    const s = sNow;
    section = Math.min(POSES.length - 1, Math.floor(s));
    poseAt(s, pose);
    ptr.x += (pointer.x - ptr.x) * Math.min(1, dt * 4); ptr.y += (pointer.y - ptr.y) * Math.min(1, dt * 4);
    const wobble = reducedMotion.matches ? 0 : 1;
    camera.position.set(pose.pos[0] + ptr.x * 0.5 * wobble + 0.25 * Math.sin(t * 0.2) * wobble, pose.pos[1] - ptr.y * 0.3 * wobble, pose.pos[2]);
    camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
    if (Math.abs(camera.fov - pose.fov) > 1e-3) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
    const inIsland = s >= SWAP_S;
    H.group.visible = !inIsland; I.group.visible = inIsland; uSky.value = inIsland ? 1 : 0;
    const swap = Math.max(0, 1 - Math.abs(s - SWAP_S) / 0.07);
    post.uniforms.flash.value = swap * 0.95;
    H.setDoor(smooth((s - 2.15) / 0.6));
    post.uniforms.speedLines.value = 0.5 * smooth((s - 2.4) / 0.5) * (1 - smooth((s - 2.95) / 0.15));
    I.setDusk(smooth((s - 6.0) / 0.8));
    post.uniforms.vignette.value = 0.35 + 0.1 * smooth((s - 6.2) / 0.8);
    (inIsland ? I : H).update(t, dt);
    post.render();
    // frame-time governor: cheap stack -> pixel ratio 1 -> give up (page drops to posters)
    if (++slow.n >= 90) {
      const st = loop.stats();
      if (st && st.p50 > 34) {
        if (post.current === 'full') post.setQuality('cheap');
        else if (renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); size(renderer); }
        else if (st.p50 > 70 && !force && !lost) { lost = 'slow'; api.onlost?.('slow'); }
      }
      slow.n = 0; loop.reset();
    }
  };
  const loop = runLoop(renderer, tick);
  // device / context loss -> the page falls back to posters, once, without reload loops
  const gone = (why) => { if (lost) return; lost = why; console.warn('[director] render device lost:', why); loop.setEnabled(false); api.onlost?.(why); };
  renderer.backend?.device?.lost?.then((info) => gone('webgpu: ' + (info?.message || info?.reason || 'lost')));
  live.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gone('webgl context lost'); });
  console.info(`[director] ${backend}${recovered ? ' (recovered from WebGPU failure)' : ''}, tier ${tier}, quality ${post.current}, ready in ${(performance.now() - t0).toFixed(0)} ms`);

  Object.assign(api, {
    pause: () => loop.setEnabled(false), resume: () => loop.setEnabled(true),
    stats: () => ({ backend, tier, quality: post.current, ...(loop.stats() || {}), draws: renderer.info.render.drawCalls, tris: renderer.info.render.triangles }),
    // QA hooks. seek(s) pins the rail (null releases it). snap(s) pins s, warms the async pipelines over a few frames, renders one
    // and returns it as a PNG data URL grabbed in the same task as the render (a WebGPU canvas can't be screenshotted headless).
    seek(s) { lock = s; if (s != null) sNow = s; },
    async snap(s, warm = 8) {
      loop.setEnabled(false); lock = s; sNow = s;
      for (let i = 0; i < warm; i++) { tick(0.016, performance.now() / 1000); await new Promise((r) => setTimeout(r, 250)); }
      tick(0.016, performance.now() / 1000);
      const c = document.createElement('canvas'); c.width = live.width; c.height = live.height;
      c.getContext('2d').drawImage(live, 0, 0);
      return c.toDataURL('image/png');
    },
    dispose() { removeEventListener('resize', onResize); removeEventListener('pointermove', onPointer); ro.disconnect(); renderer.setAnimationLoop(null); renderer.dispose(); live.hidden = true; },
    canvas: () => live,
  });
  return api;
}
