// The opening animation itself, loaded by intro.js only when it plays: wait (briefly) for the LEGO Ninjago art, run
// the fight on a 2D canvas (scene.js), then crack the frame and shatter it like glass into the page (shatter3d.js in
// three.js, or drawShards2D in fracture.js when three.js is not there or is late).
//
// The wait: until the CORE art has decoded, at most 1.5 s after the overlay came up and no later than 3 s into the
// visit (a cached visit has it at once, index.html preloads it on the first). No art by then: no intro, straight to
// the page. three.js is only asked for at the VS card (a calm beat), so it never competes with the art or the opening.
import { createScene, BEAT, rng } from './scene.js';
import { fracture, shardMotion, drawShards2D } from './fracture.js';
import { probeGPU } from '../three/env.js';
import { loadArt } from './art.js';

export async function play({ root, skipBtn, state, ctl, reveal, end, q, touch }) {
  const html = document.documentElement;
  const drawn = q.get('introArt') === '0';
  const art = drawn ? null : loadArt();
  const mount = performance.now();
  // the GPU probe (a WebGL context: slow on some machines) runs now, in the black wait, not mid-fight
  const probe = q.get('intro3d') ? null : probeGPU();
  const deadline = Math.max(mount + 600, Math.min(mount + 1500, 3000));
  const timer = (ms) => new Promise((r) => setTimeout(() => r(false), Math.max(0, ms)));
  const ready = drawn || await Promise.race([art.core, timer(deadline - performance.now())]);
  if (state.phase === 'over') return;
  if (!ready) { end(); return; }
  // the titles use the pixel fonts (local, usually in already): a moment at most
  const fonts = Promise.all(['700 20px Silkscreen', '20px "Press Start 2P"'].map((f) => (document.fonts ? document.fonts.load(f).catch(() => null) : null)));
  await Promise.race([fonts, timer(300)]);
  if (state.phase === 'over') return;
  html.classList.add('intro-art');      // the page's poster may load now (intro.css held it back)
  window.__ylPreload?.();               // and its other preloads (poster, three.js)
  art?.late();                          // the VS portraits

  const c2 = document.createElement('canvas');
  c2.className = 'intro__c';
  c2.setAttribute('aria-hidden', 'true');
  root.insertBefore(c2, skipBtn);
  const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const R = Math.min(dpr, touch ? 1.6 : 1.5, Math.sqrt(2.4e6 / (w * h)));
  c2.width = Math.round(w * R);
  c2.height = Math.round(h * R);

  const scene = createScene(c2, { w, h, R, art: art ? art.art : null });
  const ctx = c2.getContext('2d');
  const [ix, iy] = scene.impact();
  const fr = shardMotion(fracture(w, h, ix, iy, rng(4242)), rng(777));
  scene.setFracture(fr);
  const snap = document.createElement('canvas');
  snap.width = c2.width; snap.height = c2.height;
  // the sprites the later beats need are painted now, while the screen is still black, not one per frame mid-fight
  while (scene.prepare()) { /* paint the next one */ }
  root.classList.add('is-on');

  // ---- three.js for the shatter, asked for at the VS card; whatever comes too late is thrown away
  let gl = null, glState = 'off', c3 = null;
  const release = (x, cv) => {
    try { x?.dispose(); } catch { /* lost already */ }
    try { cv?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* gone */ }
  };
  function startGL() {
    if (glState !== 'off') return;
    const want = q.get('intro3d') === '1' || (q.get('intro3d') !== '0' && probe?.ok && !probe.software && navigator.connection?.saveData !== true);
    if (!want) { glState = 'none'; return; }
    glState = 'loading';
    const cv = c3 = document.createElement('canvas');
    cv.className = 'intro__c';
    cv.setAttribute('aria-hidden', 'true');
    root.insertBefore(cv, skipBtn);
    import('./shatter3d.js')
      .then((m) => m.createShatter3D(cv, { w, h, dpr: Math.min(dpr, 1.5), fr, snap, rand: rng(99) }))
      .then((x) => {
        if (state.phase !== 'stage' || glState !== 'loading') { release(x, cv); return; }
        gl = x; glState = 'ready';
      })
      .catch((err) => {
        console.warn('[intro] three.js shatter unavailable, using 2D:', err);
        if (glState === 'loading') glState = 'failed';
        cv.remove();
        if (c3 === cv) c3 = null;
      });
  }

  let freeze = q.has('introAt') ? Math.max(0, parseFloat(q.get('introAt')) || 0) : Infinity;
  // a skip pressed during the wait starts at the impact
  let t = 0, speed = 1, last = 0, raf = 0, wait = 0, shatterAt = 0, watchdog = 0;
  if (ctl.pending === 'skip') { t = BEAT.impact - 0.04; speed = 1.6; }
  state.phase = 'stage';
  state.seek = (s) => { t = s; };
  state.hold = (s) => { freeze = s; };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!watchdog && freeze === Infinity) watchdog = setTimeout(end, 16000);
    const dt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    const t0 = performance.now();
    try {
      if (state.phase === 'stage') {
        if (t < freeze) t = Math.min(freeze, t + dt * speed);
        if (t >= BEAT.vs - 0.3) startGL();
        if (t >= BEAT.shatter) {
          // hold the cracked frame for three.js a little (up to 1.4 s), then go without it
          if (glState === 'loading' && wait < 1.4) { wait += dt; t = BEAT.shatter; }
          else { shatter(); return; }
        }
        scene.draw(Math.min(t, BEAT.shatter - 1e-3), dt);
      } else if (state.phase === 'shatter') {
        if (t < freeze) t = Math.min(freeze, t + dt * speed);
        const ts = t - shatterAt;
        const alive = gl ? gl.render(ts) : drawShards2D(ctx, snap, fr, ts, w, h, R);
        if (!alive) end();
      }
      state.t = t;
      const ms = performance.now() - t0;
      state.ms = state.ms ? state.ms * 0.9 + ms * 0.1 : ms;
      state.maxMs = Math.max(state.maxMs || 0, ms);
    } catch (err) {
      console.warn('[intro] stopped:', err);
      end();
    }
  };

  function shatter() {
    snap.getContext('2d').drawImage(c2, 0, 0);
    root.classList.add('is-shattering');
    state.phase = 'shatter';
    shatterAt = t;
    if (gl) {
      state.mode = '3d';
      gl.upload();
      gl.render(0);
      c2.style.visibility = 'hidden';
    } else {
      state.mode = '2d';
      if (glState === 'loading') glState = 'late';   // whatever arrives now is released
      c3?.remove();
      c3 = null;
      drawShards2D(ctx, snap, fr, 0, w, h, R);
    }
    reveal();
  }

  function skip() {
    if (state.phase === 'stage') {
      if (t < BEAT.impact - 0.04) t = BEAT.impact - 0.04;
      else if (t >= BEAT.shatter) wait = 1.4;     // waiting for three.js: go now
      speed = 1.6;
    } else if (state.phase === 'shatter') end();
  }

  const onResize = () => {
    if (Math.abs(root.clientWidth - w) > 2 || Math.abs(root.clientHeight - h) > 140) end();
  };
  addEventListener('resize', onResize);
  ctl.skip = skip;
  ctl.pending = null;
  ctl.onEnd = () => {
    cancelAnimationFrame(raf);
    clearTimeout(watchdog);
    window.removeEventListener('resize', onResize);
  };
  ctl.release = () => {
    if (gl) release(gl, c3);
    gl = null;
    glState = 'done';
  };

  raf = requestAnimationFrame(frame);
}
