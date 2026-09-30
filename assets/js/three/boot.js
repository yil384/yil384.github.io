// Shared bootstrapping for the demos: capability gate, renderer w/ WebGL2 fallback,
// DPR cap, visibility / reduced-motion aware loop, and a tiny perf probe.
import * as THREE from 'three/webgpu';

import { reducedMotion } from './env.js';

export { reducedMotion, probeGPU } from './env.js';

// TEST-ONLY shim: Chromium 141 (--enable-unsafe-webgpu) implements the older dictionary form
// of GPUTextureViewDescriptor.swizzle while three r186 always sends the string 'rgba'.
if (new URLSearchParams(location.search).get('shim') === 'swizzle' && globalThis.GPUTexture) {
  const orig = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function (d) {
    if (d && typeof d.swizzle === 'string') { d = { ...d }; delete d.swizzle; }
    return orig.call(this, d);
  };
}

/**
 * Renderer that survives BOTH failure modes:
 *  1. no WebGPU adapter -> three's built-in fallback to the WebGL2 backend inside init();
 *  2. WebGPU initialises but throws later (driver/IDL mismatch) -> smoke-render inside
 *     try/catch, then rebuild with forceWebGL. three does NOT do (2) for you.
 * `smoke(renderer)` should compile + render one frame of the real scene.
 */
export async function createRobustRenderer(makeCanvas, smoke, opts = {}) {
  let canvas = makeCanvas();
  let r = await createRenderer(canvas, opts);
  try {
    await smoke(r.renderer);
    return { ...r, recovered: null };
  } catch (err) {
    if (r.backend !== 'webgpu') throw err;
    console.warn('[3d] WebGPU backend failed at first render, retrying with WebGL2:', err.message);
    r.renderer.setAnimationLoop(null);
    r.renderer.dispose();
    const fresh = makeCanvas(); // a canvas that had a 'webgpu' context cannot get 'webgl2'
    canvas.replaceWith(fresh);
    canvas = fresh;
    const r2 = await createRenderer(canvas, { ...opts, forceWebGL: true });
    await smoke(r2.renderer);
    return { ...r2, recovered: String(err.message).slice(0, 120) };
  }
}

export async function createRenderer(canvas, { maxDpr = 1.75, antialias = true, alpha = true, forceWebGL = false } = {}) {
  const q = new URLSearchParams(location.search);
  const renderer = new THREE.WebGPURenderer({
    canvas, antialias, alpha,
    forceWebGL: forceWebGL || q.get('webgl') === '1',
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  const t0 = performance.now();
  await renderer.init(); // resolves after WebGPU OR the automatic WebGL2 fallback is ready
  const backend = renderer.backend.isWebGPUBackend ? 'webgpu' : (renderer.backend.isWebGLBackend ? 'webgl2' : 'unknown');
  return { renderer, backend, initMs: performance.now() - t0 };
}

/** rAF loop that stops when the tab is hidden or the canvas is off-screen. */
export function runLoop(renderer, tick, { target = null } = {}) {
  let visible = true;
  let onScreen = true;
  let enabled = true;
  let last = performance.now();
  const frames = [];
  const step = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    frames.push(now - last);
    if (frames.length > 600) frames.shift();
    last = now;
    tick(dt, now / 1000);
  };
  const sync = () => {
    const run = enabled && visible && onScreen && !reducedMotion.matches;
    renderer.setAnimationLoop(run ? step : null);
    if (run) last = performance.now();
  };
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; sync(); });
  reducedMotion.addEventListener?.('change', () => { sync(); if (reducedMotion.matches) tick(0, 0); });
  if (target) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(target);
  if (reducedMotion.matches) tick(0, 0); // one static frame
  sync();
  return {
    setEnabled(on) { enabled = !!on; sync(); },
    stats() {
      const f = frames.slice(5).sort((a, b) => a - b);
      if (!f.length) return null;
      const avg = f.reduce((a, b) => a + b, 0) / f.length;
      return { n: f.length, avgMs: +avg.toFixed(2), p50: +f[f.length >> 1].toFixed(2), p95: +f[Math.floor(f.length * 0.95)].toFixed(2) };
    },
    reset() { frames.length = 0; },
  };
}

export function memoryInfo(renderer) {
  const m = performance.memory;
  return {
    jsHeapMB: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : null,
    gpuTrackedMB: +(renderer.info.memory.total / 1048576).toFixed(2),
    texturesMB: +(renderer.info.memory.texturesSize / 1048576).toFixed(2),
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.memory.programs,
    drawCalls: renderer.info.render.drawCalls,
    triangles: renderer.info.render.triangles,
  };
}
